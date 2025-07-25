# Dockerfile personalizado para Cloud Functions / Cloud Run
# Base oficial Node.js 20 optimizada para Cloud Functions
FROM node:20-slim

# Instala LibreOffice para conversión PDF→DOCX
RUN apt-get update -qq \
    && apt-get install -y --no-install-recommends \
        libreoffice-writer libreoffice-impress libreoffice-calc \
        ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copiar el código de la función
COPY . /workspace
WORKDIR /workspace

# Instalar dependencias de producción
RUN npm install --omit=dev --silent

# Puerto que usará la función (lo establece Cloud Run)
ENV PORT=8080

# Comando por defecto
CMD ["npm", "start"]
