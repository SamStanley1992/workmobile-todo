import React, { useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../firebase/AuthContext';
import { Upload, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react';

export default function FirestoreMigrationButton() {
  const { currentUser } = useAuth();
  const [showDialog, setShowDialog] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [result, setResult] = useState(null);

  if (!currentUser) return null;

  const userEmail = currentUser.email;
  const userId = userEmail.replace(/[@.]/g, '_');

  const migrateFromOldCollections = async () => {
    setMigrating(true);
    setResult(null);
    const migrated = [];
    const errors = [];

    try {
      // Migrate from old main-tasks/shared to user-tasks/{userId}
      const oldTasksRef = doc(db, 'main-tasks', 'shared');
      const oldTasksSnap = await getDoc(oldTasksRef);
      if (oldTasksSnap.exists()) {
        const data = oldTasksSnap.data();
        await setDoc(doc(db, 'user-tasks', userId), data);
        migrated.push(`Tasks (${data.value?.length || 0} items)`);
      }

      // Migrate from old main-tasks-tags/shared to user-tasks-tags/{userId}
      const oldTagsRef = doc(db, 'main-tasks-tags', 'shared');
      const oldTagsSnap = await getDoc(oldTagsRef);
      if (oldTagsSnap.exists()) {
        const data = oldTagsSnap.data();
        await setDoc(doc(db, 'user-tasks-tags', userId), data);
        migrated.push(`Tags (${data.value?.length || 0} items)`);
      }

      // Migrate from old main-tasks-deleted/shared to user-tasks-deleted/{userId}
      const oldDeletedRef = doc(db, 'main-tasks-deleted', 'shared');
      const oldDeletedSnap = await getDoc(oldDeletedRef);
      if (oldDeletedSnap.exists()) {
        const data = oldDeletedSnap.data();
        await setDoc(doc(db, 'user-tasks-deleted', userId), data);
        migrated.push(`Deleted Tasks (${data.value?.length || 0} items)`);
      }

      // Only for sam.stanley@workmobileforms.com - migrate team tasks
      if (userEmail === 'sam.stanley@workmobileforms.com') {
        // Migrate team-tasks/tasks to user-team-tasks/{userId}_tasks
        const oldTeamTasksRef = doc(db, 'team-tasks', 'tasks');
        const oldTeamTasksSnap = await getDoc(oldTeamTasksRef);
        if (oldTeamTasksSnap.exists()) {
          const data = oldTeamTasksSnap.data();
          await setDoc(doc(db, 'user-team-tasks', `${userId}_tasks`), data);
          migrated.push(`Team Tasks (${data.value?.length || 0} items)`);
        }

        // Migrate team-tasks/assignments
        const oldAssignmentsRef = doc(db, 'team-tasks', 'assignments');
        const oldAssignmentsSnap = await getDoc(oldAssignmentsRef);
        if (oldAssignmentsSnap.exists()) {
          const data = oldAssignmentsSnap.data();
          await setDoc(doc(db, 'user-team-tasks', `${userId}_assignments`), data);
          migrated.push(`Assignments (${data.value?.length || 0} items)`);
        }

        // Migrate team-tasks/subordinates
        const oldSubordinatesRef = doc(db, 'team-tasks', 'subordinates');
        const oldSubordinatesSnap = await getDoc(oldSubordinatesRef);
        if (oldSubordinatesSnap.exists()) {
          const data = oldSubordinatesSnap.data();
          await setDoc(doc(db, 'user-team-tasks', `${userId}_subordinates`), data);
          migrated.push(`Team Members (${data.value?.length || 0} items)`);
        }

        // Migrate team-tasks/tags
        const oldTeamTagsRef = doc(db, 'team-tasks', 'tags');
        const oldTeamTagsSnap = await getDoc(oldTeamTagsRef);
        if (oldTeamTagsSnap.exists()) {
          const data = oldTeamTagsSnap.data();
          await setDoc(doc(db, 'user-team-tasks', `${userId}_tags`), data);
          migrated.push(`Team Tags (${data.value?.length || 0} items)`);
        }
      }

      setResult({
        success: errors.length === 0,
        migrated,
        errors,
      });
    } catch (error) {
      setResult({
        success: false,
        migrated,
        errors: [...errors, error.message],
      });
    } finally {
      setMigrating(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        className="flex items-center gap-2 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
      >
        <Upload className="h-4 w-4" />
        Migrate Old Data
      </button>

      {showDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Migrate to User-Specific Storage</h2>
              <button
                onClick={() => setShowDialog(false)}
                disabled={migrating}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {!result && (
              <>
                <p className="text-gray-600 mb-4">
                  Your data is in the old shared collections. This will migrate it to your personal user-specific collections.
                </p>
                <p className="text-sm text-gray-500 mb-6">
                  This is a one-time migration. Click below to retrieve your tasks.
                </p>
              </>
            )}

            {result && (
              <div className="mb-4">
                {result.success ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-semibold text-green-900">Migration Complete!</span>
                    </div>
                    {result.migrated.length > 0 ? (
                      <ul className="text-sm text-green-800 list-disc list-inside">
                        {result.migrated.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-green-700">No data found to migrate.</p>
                    )}
                    <p className="text-sm text-green-700 mt-2">
                      Refresh the page to see your data!
                    </p>
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-5 w-5 text-red-600" />
                      <span className="font-semibold text-red-900">Migration Issues</span>
                    </div>
                    {result.errors.length > 0 && (
                      <ul className="text-sm text-red-800 list-disc list-inside">
                        {result.errors.map((error, i) => (
                          <li key={i}>{error}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              {!result && (
                <button
                  onClick={migrateFromOldCollections}
                  disabled={migrating}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {migrating ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Migrating...
                    </>
                  ) : (
                    <>
                      <Upload className="h-5 w-5" />
                      Migrate Now
                    </>
                  )}
                </button>
              )}
              <button
                onClick={() => {
                  setShowDialog(false);
                  setResult(null);
                  if (result?.success) {
                    window.location.reload();
                  }
                }}
                disabled={migrating}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {result ? 'Close' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
