
export interface StoredKeyData {
  encryptedPrivateKey: string;
  publicKeyJWK: JsonWebKey;
  salt: string;
}

// Helper function to open database with proper upgrade handling
const openDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('SecureTalkKeys', 1);
    
    request.onerror = () => reject(new Error('Failed to open IndexedDB'));
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      // Only create if it doesn't exist
      if (!db.objectStoreNames.contains('keys')) {
        db.createObjectStore('keys', { keyPath: 'userId' });
      }
    };
    
    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      resolve(db);
    };
  });
};

// Store keys securely in IndexedDB
export const storeKeysSecurely = async (userId: string, keyData: StoredKeyData): Promise<void> => {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      // Ensure object store exists before creating transaction
      if (!db.objectStoreNames.contains('keys')) {
        db.close();
        reject(new Error('Keys object store not found'));
        return;
      }
      
      const transaction = db.transaction(['keys'], 'readwrite');
      const store = transaction.objectStore('keys');
      
      store.put({ userId, ...keyData });
      
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      
      transaction.onerror = () => {
        db.close();
        reject(new Error('Failed to store keys'));
      };
    });
  } catch (error) {
    console.error('Failed to store keys:', error);
    throw new Error('Key storage failed');
  }
};

// Retrieve keys from IndexedDB
export const retrieveStoredKeys = async (userId: string): Promise<StoredKeyData | null> => {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      // Ensure object store exists before creating transaction
      if (!db.objectStoreNames.contains('keys')) {
        db.close();
        resolve(null);
        return;
      }
      
      const transaction = db.transaction(['keys'], 'readonly');
      const store = transaction.objectStore('keys');
      const getRequest = store.get(userId);
      
      getRequest.onsuccess = () => {
        db.close();
        const result = getRequest.result;
        resolve(result ? {
          encryptedPrivateKey: result.encryptedPrivateKey,
          publicKeyJWK: result.publicKeyJWK,
          salt: result.salt
        } : null);
      };
      
      getRequest.onerror = () => {
        db.close();
        reject(new Error('Failed to retrieve keys'));
      };
    });
  } catch (error) {
    console.error('Failed to retrieve keys:', error);
    throw new Error('Key retrieval failed');
  }
};
