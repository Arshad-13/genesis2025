# Docker & DevOps Skill — Containerization, Deployment, CI/CD

You are working on the **Genesis 2025** deployment infrastructure running on AWS.

## Container Architecture

```
docker-compose.yml
├── postgres (timescale/timescaledb:latest-pg14)  → :5432
├── cpp-analytics (cpp_engine/)                     → :50051
└── backend (FastAPI)                               → :8000
```

## Docker Commands Reference
```bash
# Start all services
cd backend && docker-compose up -d

# View logs
docker-compose logs -f cpp-analytics

# Rebuild a service after code change
docker-compose build cpp-analytics && docker-compose up -d cpp-analytics

# Check status
docker-compose ps

# Stop everything
docker-compose down

# Clean rebuild
docker-compose down -v && docker-compose build --no-cache && docker-compose up -d
```

## AWS Production Infrastructure
- **Orchestration**: Dockerized microservices on Amazon ECS
- **Database**: RDS (PostgreSQL + TimescaleDB)
- **Storage**: S3 for report storage (`tradinghub-report` bucket)
- **Monitoring**: CloudWatch logs + Amazon SES email alerts
- **CI/CD**: GitHub → EC2/ECR deployment pipeline
- **Load Balancer**: Application Load Balancer (ALB)
- **Security**: VPC isolation, security groups, SSL/TLS
- **Region**: eu-north-1

## Environment Variables (AWS Production)
```bash
AWS_ACCESS_KEY_ID=...       # S3 access
AWS_SECRET_ACCESS_KEY=...   # S3 access
AWS_REGION=eu-north-1
S3_BUCKET_NAME=tradinghub-report
```

## Development Setup
```bash
# 1. Start database + C++ engine
cd backend && docker-compose up -d

# 2. Market ingestor (run locally)
cd market_ingestor && python main.py

# 3. Backend (run locally)
cd backend && python main.py

# 4. Frontend (run locally)
cd market-microstructure && npm install && npm run dev
```

## Troubleshooting (Docker)
| Symptom | Command | Fix |
|---|---|---|
| C++ engine not connecting | `docker logs cpp-analytics` | Rebuild: `docker-compose build cpp-analytics` |
| DB connection refused | `docker ps \| grep postgres` | Restart: `docker-compose restart postgres` |
| Port 6000 already in use | `docker ps \| grep 6000` | Stop conflicting container |
| Backend can't reach C++ | `grpcurl -plaintext localhost:50051 list` | Check C++ engine is running |

## File Map
| File | Purpose |
|---|---|
| `backend/docker-compose.yml` | Service orchestration |
| `backend/Dockerfile` | Backend container image |
| `cpp_engine/Dockerfile` | C++ engine container image |
| `cpp_engine/CMakeLists.txt` | C++ build configuration |
| `market-microstructure/vite.config.js` | Frontend build config |

## When Modifying Deployment
1. Test locally with docker-compose first
2. Update environment variables in AWS ECS task definition
3. Run smoke tests after deployment (health endpoint, WebSocket connection)
4. Check CloudWatch logs for startup errors
5. Verify S3 report uploads work after deployment
