FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends chromium xvfb x11vnc fluxbox novnc websockify ca-certificates supervisor && rm -rf /var/lib/apt/lists/*
COPY supervisord.conf /etc/supervisor/conf.d/relay.conf
EXPOSE 6080 9222
CMD ["/usr/bin/supervisord", "-n"]
