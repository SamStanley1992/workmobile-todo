import { useState, useEffect } from 'react';
import { collection, doc, setDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { db } from './config';

/**
 * Hook for syncing a single document in Firestore
 * @param {string} collectionName - Firestore collection name
 * @param {string} documentId - Document ID
 * @param {any} defaultValue - Default value if document doesn't exist
 */
export function useFirestoreDoc(collectionName, documentId, defaultValue = null) {
  const [data, setData] = useState(defaultValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const docRef = doc(db, collectionName, documentId);
    
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setData(snapshot.data().value);
        } else {
          setData(defaultValue);
        }
        setLoading(false);
      },
      (err) => {
        console.error(`Error syncing ${collectionName}/${documentId}:`, err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [collectionName, documentId]);

  const updateData = async (newValue) => {
    try {
      const docRef = doc(db, collectionName, documentId);
      await setDoc(docRef, { value: newValue }, { merge: true });
    } catch (err) {
      console.error(`Error updating ${collectionName}/${documentId}:`, err);
      setError(err);
    }
  };

  const deleteData = async () => {
    try {
      const docRef = doc(db, collectionName, documentId);
      await deleteDoc(docRef);
    } catch (err) {
      console.error(`Error deleting ${collectionName}/${documentId}:`, err);
      setError(err);
    }
  };

  return { data, loading, error, updateData, deleteData };
}

/**
 * Hook for syncing multiple documents in a collection
 * Stores all data under a "shared" document for simplicity
 */
export function useFirestoreCollection(collectionName, defaultValue = []) {
  return useFirestoreDoc(collectionName, 'shared', defaultValue);
}
