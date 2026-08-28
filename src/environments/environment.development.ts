/**
 * Configuración de entorno para DESARROLLO (LOCAL)
 * 
 * En local, la API se ejecuta en el contenedor Docker en http://localhost:8000/api
 */
export const environment = {
  production: false,
  appUrl: 'http://localhost:4200',
  apiUrl: 'http://localhost:8000/api'
};
