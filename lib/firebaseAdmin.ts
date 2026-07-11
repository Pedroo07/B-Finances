import { initializeApp, getApps, cert, applicationDefault, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  let serviceAccount: ServiceAccount | undefined;

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) as ServiceAccount;
    } catch (e) {
      console.error("Erro ao fazer parse:", e);
    }
  }

  initializeApp({
    credential: serviceAccount 
      ? cert(serviceAccount) 
      : applicationDefault(), // Função importada diretamente
  });
}

export const db = getFirestore();
