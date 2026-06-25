/**
 * API Configuration for TaskManagement App
 * 
 * DEVELOPMENT: 10.0.2.2:3000 (Android Emulator local backend)
 * PRODUCTION: https://your-project.vercel.app (Vercel deployed backend)
 * 
 * Usage: Import getApiBaseUrl() in your components
 */

// ============================================
// LOCAL DEVELOPMENT (Emulator)
// ============================================
const LOCAL_API_URL = 'http://10.0.2.2:3000';

// ============================================
// PRODUCTION (Vercel)
// ============================================
const VERCEL_API_URL = 'https://your-project.vercel.app'; // TODO: Replace with your Vercel URL

// ============================================
// Auto-detect based on environment
// ============================================
export const getApiBaseUrl = (): string => {
  // For development: use local backend
  if (__DEV__) {
    return LOCAL_API_URL;
  }
  
  // For production build: use Vercel backend
  return VERCEL_API_URL;
};

// ============================================
// Helper to switch manually (optional)
// ============================================
export const API_CONFIG = {
  LOCAL: LOCAL_API_URL,
  PRODUCTION: VERCEL_API_URL,
  CURRENT: getApiBaseUrl(),
};

export default getApiBaseUrl;
