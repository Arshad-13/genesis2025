/**
 * Environment configuration validation
 * Validates required environment variables and provides defaults
 */

const requiredVars = {
  VITE_BACKEND_HTTP: {
    default: 'http://localhost:8000',
    description: 'Backend HTTP URL',
  },
  VITE_BACKEND_WS: {
    default: null, // Derived from HTTP
    description: 'Backend WebSocket URL',
  },
};

class ConfigValidator {
  constructor() {
    this.config = {};
    this.warnings = [];
    this.validate();
  }

  validate() {
    const env = import.meta.env;

    // Validate and set BACKEND_HTTP
    this.config.BACKEND_HTTP = env.VITE_BACKEND_HTTP || requiredVars.VITE_BACKEND_HTTP.default;
    if (!env.VITE_BACKEND_HTTP) {
      this.warnings.push(`VITE_BACKEND_HTTP not set, using default: ${this.config.BACKEND_HTTP}`);
    }

    // Derive or validate BACKEND_WS
    if (env.VITE_BACKEND_WS) {
      this.config.BACKEND_WS = env.VITE_BACKEND_WS;
    } else {
      this.config.BACKEND_WS = this.config.BACKEND_HTTP.replace(/^http/, 'ws') + '/ws';
      this.warnings.push(`VITE_BACKEND_WS not set, derived: ${this.config.BACKEND_WS}`);
    }

    // Validate environment mode
    this.config.MODE = env.MODE || 'development';
    this.config.IS_PRODUCTION = this.config.MODE === 'production';
    this.config.IS_DEVELOPMENT = this.config.MODE === 'development';

    // Log warnings in development
    if (this.warnings.length > 0 && !this.config.IS_PRODUCTION) {
      console.group('⚠️ Environment Configuration Warnings');
      this.warnings.forEach(warning => console.warn(warning));
      console.groupEnd();
    }
  }

  get(key) {
    return this.config[key];
  }

  getAll() {
    return { ...this.config };
  }
}

// Singleton instance
const config = new ConfigValidator();

export default config;
