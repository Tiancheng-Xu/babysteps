FROM public.ecr.aws/docker/library/node:22-alpine
RUN apk add --no-cache curl \
	&& mkdir -p /app/certificates \
	&& curl --fail --silent --show-error \
		https://truststore.pki.rds.amazonaws.com/us-east-1/us-east-1-bundle.pem \
		-o /app/certificates/us-east-1-bundle.pem \
	&& chown -R node:node /app/certificates
WORKDIR /app
COPY aws/dist/performance/cleaner.mjs ./cleaner.mjs
COPY aws/migrations/0002_performance.sql ./migrations/0002_performance.sql
USER node
ENV NODE_EXTRA_CA_CERTS=/app/certificates/us-east-1-bundle.pem
CMD ["node", "cleaner.mjs"]
