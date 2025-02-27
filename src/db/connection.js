// src/db/connection.js
const { Connection, Request } = require('tedious');
const { Connector } = require('@google-cloud/cloud-sql-connector');
const config = require('../config');

class DatabasePool {
  constructor() {
    this.connectionPool = [];
    this.MAX_POOL_SIZE = config.database.maxPoolSize;
  }

  async createNewConnection() {
    try {
      const connector = new Connector();
      const clientOpts = await connector.getTediousOptions({
        instanceConnectionName: config.database.server,
        ipType: 'PUBLIC',
      });

      const connection = new Connection({
        server: '0.0.0.0',
        authentication: {
          type: 'default',
          options: {
            userName: config.database.user,
            password: config.database.password,
          },
        },
        options: {
          ...clientOpts,
          port: 9999,
          database: config.database.name,
          trustServerCertificate: true,
          encrypt: false,
          connectTimeout: 30000,
          requestTimeout: 30000,
          retry: {
            maxRetries: 3,
            minTimeout: 300,
            maxTimeout: 3000
          }
        },
      });

      return new Promise((resolve, reject) => {
        connection.connect(err => {
          if (err) {
            reject(err);
            return;
          }
          resolve(connection);
        });
      });
    } catch (error) {
      throw error;
    }
  }

  async getConnection() {
    // Remove closed connections from the pool
    for (let i = this.connectionPool.length - 1; i >= 0; i--) {
      if (this.connectionPool[i].state.name === 'Final') {
        this.connectionPool.splice(i, 1);
      }
    }

    // Find an available connection
    const availableConnection = this.connectionPool.find(conn => 
      conn.state.name === 'LoggedIn' && !conn.isExecuting);

    if (availableConnection) {
      return availableConnection;
    }

    // Create new connection if pool isn't full
    if (this.connectionPool.length < this.MAX_POOL_SIZE) {
      const newConnection = await this.createNewConnection();
      this.connectionPool.push(newConnection);
      return newConnection;
    }

    // Wait for an available connection
    return new Promise((resolve) => {
      const checkInterval = setInterval(async () => {
        const conn = this.connectionPool.find(c => 
          c.state.name === 'LoggedIn' && !c.isExecuting);
        if (conn) {
          clearInterval(checkInterval);
          resolve(conn);
        }
      }, 100);
    });
  }

  async executeQuery(query, params = []) {
    let connection;
    try {
      connection = await this.getConnection();
      
      return new Promise((resolve, reject) => {
        const request = new Request(query, (err) => {
          if (err) {
            reject(err);
          }
        });

        params.forEach((param, index) => {
          request.addParameter(`param${index}`, param.type, param.value);
        });

        const results = [];
        request.on('row', (columns) => {
          results.push(columns);
        });

        request.on('requestCompleted', () => {
          resolve(results);
        });

        request.on('error', (err) => {
          reject(err);
        });

        connection.execSql(request);
      });
    } catch (error) {
      // If connection error occurs, try to create a new connection
      if (connection && connection.state.name === 'Final') {
        const index = this.connectionPool.indexOf(connection);
        if (index > -1) {
          this.connectionPool.splice(index, 1);
        }
      }
      throw error;
    }
  }
}

module.exports = new DatabasePool();