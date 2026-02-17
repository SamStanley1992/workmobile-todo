// One-time migration script to move localStorage data to Firestore
// Run this in the browser console while logged in

import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export async function migrateLocalStorageToFirestore() {
  console.log('Starting migration...');
  
  try {
    // Migrate Environments
    const envWork = localStorage.getItem('envWork');
    if (envWork) {
      const parsed = JSON.parse(envWork);
      await setDoc(doc(db, 'environments', 'shared'), { value: parsed });
      console.log('✓ Migrated environments:', parsed.length, 'items');
    }

    // Migrate Team Tasks
    const teamTasks = localStorage.getItem('teamTasks');
    if (teamTasks) {
      const parsed = JSON.parse(teamTasks);
      await setDoc(doc(db, 'team-tasks', 'tasks'), { value: parsed });
      console.log('✓ Migrated team tasks:', parsed.length, 'items');
    }

    const teamAssignments = localStorage.getItem('teamAssignments');
    if (teamAssignments) {
      const parsed = JSON.parse(teamAssignments);
      await setDoc(doc(db, 'team-tasks', 'assignments'), { value: parsed });
      console.log('✓ Migrated assignments:', parsed.length, 'items');
    }

    const teamSubordinates = localStorage.getItem('teamSubordinates');
    if (teamSubordinates) {
      const parsed = JSON.parse(teamSubordinates);
      await setDoc(doc(db, 'team-tasks', 'subordinates'), { value: parsed });
      console.log('✓ Migrated subordinates:', parsed.length, 'items');
    }

    const tags = localStorage.getItem('tags');
    if (tags) {
      const parsed = JSON.parse(tags);
      await setDoc(doc(db, 'team-tasks', 'tags'), { value: parsed });
      console.log('✓ Migrated tags:', parsed.length, 'items');
    }

    // Migrate Release Schedule
    const releaseStreams = localStorage.getItem('releaseStreams');
    if (releaseStreams) {
      const parsed = JSON.parse(releaseStreams);
      await setDoc(doc(db, 'release-schedule', 'streams'), { value: parsed });
      console.log('✓ Migrated release streams:', parsed.length, 'items');
    }

    const releaseItems = localStorage.getItem('releaseItems');
    if (releaseItems) {
      const parsed = JSON.parse(releaseItems);
      await setDoc(doc(db, 'release-schedule', 'releases'), { value: parsed });
      console.log('✓ Migrated releases:', parsed.length, 'items');
    }

    // Migrate Bug Builder Draft
    const bugBuilderDraft = localStorage.getItem('bugBuilderDraft');
    if (bugBuilderDraft) {
      const parsed = JSON.parse(bugBuilderDraft);
      // Don't migrate environment, keep that local
      delete parsed.environment;
      await setDoc(doc(db, 'bug-builder', 'draft'), { value: parsed });
      console.log('✓ Migrated bug builder draft');
    }

    console.log('✅ Migration complete! Data is now in Firestore and will sync across devices.');
    console.log('You can now safely clear localStorage if needed.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Auto-run migration if window.runMigration is set
if (typeof window !== 'undefined' && window.runMigration) {
  migrateLocalStorageToFirestore();
}
