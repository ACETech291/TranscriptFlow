FROM node:20-alpine

WORKDIR /app

# Cài đặt dependencies
COPY package*.json ./
RUN npm ci

# Sao chép toàn bộ mã nguồn
COPY . .

# Build ứng dụng frontend ra thư mục dist
RUN npm run build

# Thiết lập cổng và môi trường production cho Fly.io
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Khởi chạy server phục vụ static files và API backend tại cổng 8080
CMD ["node", "server.js"]
