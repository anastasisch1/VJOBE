FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci && npm cache clean --force

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgtk-3-0 libnss3 libatk-bridge2.0-0 libxss1 libasound2 libgbm1 \
    libdrm2 libx11-xcb1 libxkbcommon0 libxshmfence1 \
    xvfb x11-utils openbox x11vnc novnc websockify dbus-x11 fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /data && chown node:node /data
WORKDIR /app
COPY --from=dependencies /app/node_modules/electron ./node_modules/electron
COPY package.json main.js preload.js ./
COPY src/app.js src/index.html src/styles.css ./src/
COPY assets/ ./assets/
COPY docker/entrypoint.sh /usr/local/bin/vjobe-desktop
RUN chmod 755 /usr/local/bin/vjobe-desktop
ENV DISPLAY=:99 XDG_CONFIG_HOME=/data NODE_ENV=production
USER node
EXPOSE 6080
VOLUME ["/data"]
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=6 \
    CMD node -e "require('http').get('http://127.0.0.1:6080/vnc.html',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
ENTRYPOINT ["/usr/local/bin/vjobe-desktop"]
