const { Connection, Request } = require('tedious');
const config = require('../config');

// Only import Cloud SQL connector when needed
let Connector;

class DatabasePool {
  constructor() {
    this.connectionPool = [];
    this.MAX_POOL_SIZE = config.database.maxPoolSize || 10;
    this.inUseConnections = new Set(); // Track connections currently in use
    
    this.isLocalDevelopment = process.env.NODE_ENV === 'development';
    console.log('Environment:', process.env.NODE_ENV);
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
      
      // Add event listeners for connection state changes
      connection.on('error', (err) => {
        console.error('Connection error event:', err);
        this.removeConnection(connection);
      });
      
      connection.on('end', () => {
        this.removeConnection(connection);
      });

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
  
  removeConnection(connection) {
    const index = this.connectionPool.indexOf(connection);
    if (index > -1) {
      this.connectionPool.splice(index, 1);
    }
    this.inUseConnections.delete(connection);
  }

  async getConnection() {
    // First, clean up any dead connections
    this.cleanupDeadConnections();
    
    // Try to find an available connection that's not in use
    const availableConnection = this.connectionPool.find(conn => 
      conn.state && conn.state.name === 'LoggedIn' && !this.inUseConnections.has(conn));

    if (availableConnection) {
      this.inUseConnections.add(availableConnection);
      return availableConnection;
    }

    // Create new connection if pool isn't full
    if (this.connectionPool.length < this.MAX_POOL_SIZE) {
      const newConnection = await this.createNewConnection();
      this.connectionPool.push(newConnection);
      this.inUseConnections.add(newConnection);
      return newConnection;
    }

    // Wait for a connection to become available
    console.log('Connection pool full, waiting for an available connection...');
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(async () => {
        this.cleanupDeadConnections();
        
        const availableConn = this.connectionPool.find(conn => 
          conn.state && conn.state.name === 'LoggedIn' && !this.inUseConnections.has(conn));
        
        if (availableConn) {
          clearInterval(checkInterval);
          this.inUseConnections.add(availableConn);
          resolve(availableConn);
        } else if (this.connectionPool.length < this.MAX_POOL_SIZE) {
          clearInterval(checkInterval);
          try {
            const newConn = await this.createNewConnection();
            this.connectionPool.push(newConn);
            this.inUseConnections.add(newConn);
            resolve(newConn);
          } catch (err) {
            reject(err);
          }
        }
      }, 100);
      
      // Set a timeout to prevent waiting indefinitely
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Timed out waiting for available connection'));
      }, 10000);
    });
  }
  
  cleanupDeadConnections() {
    for (let i = this.connectionPool.length - 1; i >= 0; i--) {
      const conn = this.connectionPool[i];
      if (!conn.state || conn.state.name !== 'LoggedIn') {
        try {
          conn.close();
        } catch (e) {
          // Ignore errors during closing
        }
        this.connectionPool.splice(i, 1);
        this.inUseConnections.delete(conn);
      }
    }
  }

  async executeQuery(query, params = []) {
    let connection;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        connection = await this.getConnection();
        
        const result = await new Promise((resolve, reject) => {
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
            // Release the connection back to the pool
            this.inUseConnections.delete(connection);
            resolve(results);
          });

          request.on('error', (err) => {
            this.inUseConnections.delete(connection);
            reject(err);
          });

          connection.execSql(request);
        });
        
        return result;
      } catch (error) {
        attempts++;
        console.error(`Query attempt ${attempts} failed:`, error);
        
        // Remove problematic connection from pool
        if (connection) {
          try {
            connection.close();
          } catch (e) {
            // Ignore errors during closing
          }
          this.removeConnection(connection);
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