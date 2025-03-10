// src/db/connection.js
const { Connection, Request } = require('tedious');
const config = require('../config');

// Only import Cloud SQL connector when needed
let Connector;

class DatabasePool {
  constructor() {
    this.connectionPool = [];
    this.MAX_POOL_SIZE = config.database.maxPoolSize || 10;
    
    // Make absolutely sure we detect development mode correctly
    console.log('Environment:', process.env.NODE_ENV);
    this.isLocalDevelopment = process.env.NODE_ENV === 'development';
  }

  async createNewConnection() {
    try {
      let connectionConfig;

      if (this.isLocalDevelopment) {
        // Local SQL Server connection for development
        console.log('Creating local development connection');
        connectionConfig = {
          server: 'CASPER\\SQLEXPRESS',
          authentication: {
            type: 'default',
            options: {
              userName: 'henry',
              password: 'henry123',
            },
          },
          options: {
            database: 'PAL-AI',
            trustServerCertificate: true,
            enableArithAbort: true,
            encrypt: false,
            connectTimeout: 30000,
            requestTimeout: 30000,
          },
        };
      } else {
        // Cloud SQL connection for production
        console.log('Creating production connection');
        
        if (!Connector) {
          const { Connector: CloudSqlConnector } = require('@google-cloud/cloud-sql-connector');
          Connector = CloudSqlConnector;
        }
        
        const connector = new Connector();
        const clientOpts = await connector.getTediousOptions({
          instanceConnectionName: config.database.server,
          ipType: 'PUBLIC',
        });

        connectionConfig = {
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
        };
      }

      const connection = new Connection(connectionConfig);

      return new Promise((resolve, reject) => {
        connection.connect(err => {
          if (err) {
            console.error('Connection error:', err);
            reject(err);
            return;
          }
          console.log('Connection successful');
          resolve(connection);
        });
      });
    } catch (error) {
      console.error('Error creating connection:', error);
      throw error;
    }
  }

  async getConnection() {
    // Remove closed connections from the pool
    for (let i = this.connectionPool.length - 1; i >= 0; i--) {
      if (this.connectionPool[i].state.name !== 'LoggedIn') {
        try {
          this.connectionPool[i].close();
        } catch (e) {
          // Ignore errors during closing
        }
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

    // Create a new connection anyway if we can't find an available one
    // This is safer than waiting indefinitely
    if (this.connectionPool.length > 0) {
      try {
        // Try to close the oldest connection
        this.connectionPool[0].close();
      } catch (e) {
        // Ignore errors during closing
      }
      this.connectionPool.splice(0, 1);
      
      const newConnection = await this.createNewConnection();
      this.connectionPool.push(newConnection);
      return newConnection;
    }

    // Create a new connection as a last resort
    const newConnection = await this.createNewConnection();
    this.connectionPool.push(newConnection);
    return newConnection;
  }

  async executeQuery(query, params = []) {
    let connection;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
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
        attempts++;
        
        // Remove problematic connection from pool
        if (connection) {
          try {
            connection.close();
          } catch (e) {
            // Ignore errors during closing
          }
          
          const index = this.connectionPool.indexOf(connection);
          if (index > -1) {
            this.connectionPool.splice(index, 1);
          }
        }
        
        // If we've reached max attempts, throw the error
        if (attempts >= maxAttempts) {
          throw error;
        }
        
        // Wait a moment before retrying
        await new Promise(resolve => setTimeout(resolve, 500 * attempts));
      }
    }
  }
}

module.exports = new DatabasePool();