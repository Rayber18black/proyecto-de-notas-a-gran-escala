import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (e) {}
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function translateError(error: string | Error | any): string {
  if (!error) return "Error desconocido";
  const msg = typeof error === "string" ? error : error?.message || String(error);
  
  if (msg.includes("Invalid login credentials")) return "Usuario o contraseña incorrectos";
  if (msg.includes("User already registered")) return "El usuario ya está registrado";
  if (msg.includes("Password should be at least")) return "La contraseña debe tener al menos 6 caracteres";
  if (msg.includes("Email rate limit exceeded")) return "Demasiados intentos. Intenta más tarde";
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) return "Error de conexión con el servidor";
  if (msg.includes("duplicate key value")) return "El registro ya existe (información duplicada)";
  if (msg.includes("No se pudo ejecutar la consulta") || msg.includes("relation")) return "Error en la base de datos (faltan tablas)";

  return msg;
}
