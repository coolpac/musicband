/**
 * Разрешённые origins для CORS (Express и Socket.IO).
 * В production FRONTEND_URL обязателен (проверка в app.ts).
 */
function getAllowedOrigins(): string[] {
  const origins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  if (process.env.NODE_ENV !== 'production') {
    origins.push(
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000'
    );
  }

  return origins;
}

export { getAllowedOrigins };
