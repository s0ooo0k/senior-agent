FROM node:20-bookworm-slim

WORKDIR /app

# 필수 도구 (healthcheck용 curl)
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=development \
    NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 3000

# dev 모드로 외부 접근 가능하게 실행
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3000"]
