-- Initialize test database schema for CNS-ByteStar-Marketplace integration tests

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    api_key VARCHAR(255) UNIQUE NOT NULL,
    permissions TEXT[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Assets table
CREATE TABLE IF NOT EXISTS assets (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    provider VARCHAR(255) NOT NULL REFERENCES users(id),
    price DECIMAL(10,2) NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(255) PRIMARY KEY,
    buyer_id VARCHAR(255) NOT NULL REFERENCES users(id),
    seller_id VARCHAR(255) NOT NULL REFERENCES users(id),
    asset_id VARCHAR(255) NOT NULL REFERENCES assets(id),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    payment_method VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CNS validation logs
CREATE TABLE IF NOT EXISTS cns_validations (
    id SERIAL PRIMARY KEY,
    domain VARCHAR(255) NOT NULL,
    validation_result BOOLEAN NOT NULL,
    validation_time_ns BIGINT,
    semantic_analysis JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ByteStar inference logs
CREATE TABLE IF NOT EXISTS bytestar_inferences (
    id SERIAL PRIMARY KEY,
    model_id VARCHAR(255) NOT NULL,
    input_data JSONB,
    output_data JSONB,
    inference_time_ms DECIMAL(10,3),
    operations_used BIGINT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key);
CREATE INDEX IF NOT EXISTS idx_assets_provider ON assets(provider);
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
CREATE INDEX IF NOT EXISTS idx_transactions_buyer ON transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_seller ON transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_cns_validations_domain ON cns_validations(domain);
CREATE INDEX IF NOT EXISTS idx_bytestar_inferences_model ON bytestar_inferences(model_id);

-- Insert test data
INSERT INTO users (id, email, name, role, api_key, permissions) VALUES
('user-admin-001', 'admin@test.com', 'Test Admin', 'admin', 'test_admin_key_001', ARRAY['*']),
('user-provider-001', 'provider1@test.com', 'Test Provider 1', 'provider', 'test_provider_key_001', ARRAY['asset:create', 'asset:update', 'asset:delete', 'transaction:view']),
('user-provider-002', 'provider2@test.com', 'Test Provider 2', 'provider', 'test_provider_key_002', ARRAY['asset:create', 'asset:update', 'asset:delete', 'transaction:view']),
('user-buyer-001', 'buyer1@test.com', 'Test Buyer 1', 'user', 'test_buyer_key_001', ARRAY['asset:view', 'transaction:create']),
('user-buyer-002', 'buyer2@test.com', 'Test Buyer 2', 'user', 'test_buyer_key_002', ARRAY['asset:view', 'transaction:create'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO assets (id, name, type, provider, price, metadata) VALUES
('asset-model-001', 'Advanced NLP Model', 'model', 'user-provider-001', 999.99, '{"accuracy": 0.95, "size": "2.1GB", "framework": "PyTorch", "language": "en", "version": "1.0.0"}'),
('asset-dataset-001', 'Financial Time Series Dataset', 'dataset', 'user-provider-001', 499.99, '{"records": 1000000, "timespan": "2020-2024", "format": "CSV", "size": "500MB"}'),
('asset-algorithm-001', 'Quantum-Enhanced Optimizer', 'algorithm', 'user-provider-002', 1499.99, '{"complexity": "O(log n)", "domain": "optimization", "quantum": true, "version": "2.0.0"}'),
('asset-model-002', 'Computer Vision Model', 'model', 'user-provider-002', 799.99, '{"accuracy": 0.92, "size": "1.8GB", "framework": "TensorFlow", "domain": "vision", "version": "1.2.0"}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO transactions (id, buyer_id, seller_id, asset_id, amount, status, completed_at) VALUES
('tx-001', 'user-buyer-001', 'user-provider-001', 'asset-model-001', 999.99, 'completed', NOW() - INTERVAL '1 day'),
('tx-002', 'user-buyer-002', 'user-provider-001', 'asset-dataset-001', 499.99, 'pending', NULL),
('tx-003', 'user-buyer-001', 'user-provider-002', 'asset-algorithm-001', 1499.99, 'completed', NOW() - INTERVAL '2 hours')
ON CONFLICT (id) DO NOTHING;