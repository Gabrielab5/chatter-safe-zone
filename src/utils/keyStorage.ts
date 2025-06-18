
export interface StoredKeyData {
  encryptedPrivateKey: string;
  publicKeyJWK: JsonWebKey;
  salt: string;
}

// Store keys securely in IndexedDB
export const storeKeysSecurely = async (userId: string, keyData: StoredKeyData): Promise<void> => {
  try {
    const request = indexedDB.open('SecureTalkKeys', 1);
    
    return new Promise((resolve, reject) => {
      request.onerror = () => reject(new Error('Failed to open IndexedDB'));
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('keys')) {
          db.createObjectStore('keys', { keyPath: 'userId' });
        }
      };
      
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
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
    const request = indexedDB.open('SecureTalkKeys', 1);
    
    return new Promise((resolve, reject) => {
      request.onerror = () => reject(new Error('Failed to open IndexedDB'));
      
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
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
      };
    });
  } catch (error) {
    console.error('Failed to retrieve keys:', error);
    throw new Error('Key retrieval failed');
  }
};
