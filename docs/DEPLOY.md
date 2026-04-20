# Context — 部署指南

## 本地开发（默认）

```bash
cd server
npm install
npx tsx src/index.ts
# → http://localhost:3100
```

## 生产部署方式

### 方式一：Tailscale（推荐，零配置安全）

```bash
# 1. 在 server 机器安装 Tailscale
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up

# 2. 启动 Context Server
CONTEXT_TOKEN=your-secret-token npx tsx src/index.ts

# 3. 其他机器通过 Tailscale IP 访问
# http://100.x.y.z:3100/s
```

优点：
- 零端口暴露，不需要公网 IP
- 自动加密，免配证书
- 设备级访问控制

### 方式二：反向代理 (Nginx/Caddy)

```nginx
# /etc/nginx/sites-available/context
server {
    listen 443 ssl;
    server_name context.your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # IP 白名单
    allow 10.0.0.0/8;
    allow 192.168.0.0/16;
    deny all;

    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Caddy (更简单):
```
context.your-domain.com {
    reverse_proxy localhost:3100
    @blocked not remote_ip 10.0.0.0/8 192.168.0.0/16
    respond @blocked 403
}
```

### 方式三：Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --production
COPY server/src ./src
COPY server/tsconfig.json .
RUN npm install -g tsx
EXPOSE 3100
ENV CONTEXT_DATA_DIR=/data
VOLUME /data
CMD ["tsx", "src/index.ts"]
```

```bash
docker build -t context-server .
docker run -d \
  -p 3100:3100 \
  -v context-data:/data \
  -e CONTEXT_TOKEN=your-secret-token \
  --name context \
  context-server
```

## 安全配置

### Token 鉴权

```bash
# 方式一：环境变量
CONTEXT_TOKEN=your-secret-token npx tsx src/index.ts

# 方式二：文件
echo "your-secret-token" > data/token.txt
npx tsx src/index.ts
```

API 调用需带 token:
```bash
# Header 方式
curl -H "X-Context-Token: your-token" http://host:3100/api/spaces

# Bearer 方式
curl -H "Authorization: Bearer your-token" http://host:3100/api/spaces

# Query 方式
curl http://host:3100/api/spaces?token=your-token
```

免验证场景：
- Web UI (`/s/*`) — 依赖网络层隔离
- 公开裂变 URL (`/ctx/*`) — 设计如此
- OpenClaw Plugin 请求（带 `X-Context-Plugin: true`）

### 防火墙规则

```bash
# 只允许本地和 Tailscale 网段
ufw allow from 127.0.0.1 to any port 3100
ufw allow from 100.64.0.0/10 to any port 3100  # Tailscale
ufw deny 3100
```

### OpenClaw Plugin 配置（公网）

```json
{
  "plugins": {
    "entries": {
      "context": {
        "enabled": true,
        "config": {
          "serverUrl": "https://context.your-domain.com",
          "token": "your-secret-token"
        }
      }
    }
  }
}
```

## 数据备份

```bash
# 备份数据目录
tar czf context-backup-$(date +%Y%m%d).tar.gz data/

# 恢复
tar xzf context-backup-*.tar.gz
```

## 监控

```bash
# 健康检查
curl -f http://localhost:3100/api/health || echo "Server down!"

# 配合 cron 做定时检查
*/5 * * * * curl -sf http://localhost:3100/api/health > /dev/null || systemctl restart context
```
