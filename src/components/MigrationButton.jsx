import React, { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../firebase/AuthContext';
import { Upload, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react';

export default function MigrationButton() {
  const { currentUser } = useAuth();
  const [showDialog, setShowDialog] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [result, setResult] = useState(null);

  if (!currentUser) return null;

  const userEmail = currentUser.email;
  const userId = userEmail.replace(/[@.]/g, '_'); // Sanitize email for use in document ID

  const hasLocalData = () => {
    return !!(
      localStorage.getItem('tasks') ||
      localStorage.getItem('envWork') ||
      localStorage.getItem('teamTasks') ||
      localStorage.getItem('releaseStreams') ||
      localStorage.getItem('bugBuilderDraft')
    );
  };

  const migrateData = async () => {
    setMigrating(true);
    setResult(null);
    const migrated = [];
    const errors = [];

    try {
      // Migrate Main Tasks (user-specific)
      const tasks = localStorage.getItem('tasks');
      if (tasks) {
        try {
          const parsed = JSON.parse(tasks);
          await setDoc(doc(db, 'user-tasks', userId), { value: parsed });
          migrated.push(`Main Tasks (${parsed.length} items)`);
        } catch (err) {
          errors.push(`Main Tasks: ${err.message}`);
        }
      }

      // Migrate Main Tasks Tags (user-specific)
      const tags = localStorage.getItem('tags');
      if (tags) {
        try {
          const parsed = JSON.parse(tags);
          await setDoc(doc(db, 'user-tasks-tags', userId), { value: parsed });
          migrated.push(`Tags (${parsed.length} items)`);
        } catch (err) {
          errors.push(`Tags: ${err.message}`);
        }
      }

      // Migrate Deleted Tasks (user-specific)
      const deletedTasks = localStorage.getItem('deletedTasks');
      if (deletedTasks) {
        try {
          const parsed = JSON.parse(deletedTasks);
          await setDoc(doc(db, 'user-tasks-deleted', userId), { value: parsed });
          migrated.push(`Deleted Tasks (${parsed.length} items)`);
        } catch (err) {
          errors.push(`Deleted Tasks: ${err.message}`);
        }
      }

      // Migrate Environments
      const envWork = localStorage.getItem('envWork');
      if (envWork) {
        try {
          const parsed = JSON.parse(envWork);
          await setDoc(doc(db, 'environments', 'shared'), { value: parsed });
          migrated.push(`Environments (${parsed.length} items)`);
        } catch (err) {
          errors.push(`Environments: ${err.message}`);
        }
      }

      // Migrate Team Tasks (only for sam.stanley@workmobileforms.com)
      if (userEmail === 'sam.stanley@workmobileforms.com') {
        const teamTasks = localStorage.getItem('teamTasks');
        if (teamTasks) {
          try {
            const parsed = JSON.parse(teamTasks);
            await setDoc(doc(db, 'user-team-tasks', `${userId}_tasks`), { value: parsed });
            migrated.push(`Team Tasks (${parsed.length} items)`);
          } catch (err) {
            errors.push(`Team Tasks: ${err.message}`);
          }
        }

        const teamAssignments = localStorage.getItem('teamAssignments');
        if (teamAssignments) {
          try {
            const parsed = JSON.parse(teamAssignments);
            await setDoc(doc(db, 'user-team-tasks', `${userId}_assignments`), { value: parsed });
            migrated.push(`Assignments (${parsed.length} items)`);
          } catch (err) {
            errors.push(`Assignments: ${err.message}`);
          }
        }

        const teamSubordinates = localStorage.getItem('teamSubordinates');
        if (teamSubordinates) {
          try {
            const parsed = JSON.parse(teamSubordinates);
            await setDoc(doc(db, 'user-team-tasks', `${userId}_subordinates`), { value: parsed });
            migrated.push(`Team Members (${parsed.length} items)`);
          } catch (err) {
            errors.push(`Team Members: ${err.message}`);
          }
        }

        const teamTasksTags = localStorage.getItem('tags');
        if (teamTasksTags) {
          try {
            const parsed = JSON.parse(teamTasksTags);
            await setDoc(doc(db, 'user-team-tasks', `${userId}_tags`), { value: parsed });
            // Don't add to migrated list if already migrated for main tasks
          } catch (err) {
            // Ignore error if already migrated
          }
        }
      }

      // Migrate Release Schedule
      const releaseStreams = localStorage.getItem('releaseStreams');
      if (releaseStreams) {
        try {
          const parsed = JSON.parse(releaseStreams);
          await setDoc(doc(db, 'release-schedule', 'streams'), { value: parsed });
          migrated.push(`Release Streams (${parsed.length} items)`);
        } catch (err) {
          errors.push(`Release Streams: ${err.message}`);
        }
      }

      const releaseItems = localStorage.getItem('releaseItems');
      if (releaseItems) {
        try {
          const parsed = JSON.parse(releaseItems);
          await setDoc(doc(db, 'release-schedule', 'releases'), { value: parsed });
          migrated.push(`Releases (${parsed.length} items)`);
        } catch (err) {
          errors.push(`Releases: ${err.message}`);
        }
      }

      // Migrate Bug Builder Draft
      const bugBuilderDraft = localStorage.getItem('bugBuilderDraft');
      if (bugBuilderDraft) {
        try {
          const parsed = JSON.parse(bugBuilderDraft);
          delete parsed.environment; // Keep environment local
          await setDoc(doc(db, 'bug-builder', 'draft'), { value: parsed });
          migrated.push('Bug Builder Draft');
        } catch (err) {
          errors.push(`Bug Builder: ${err.message}`);
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

  if (!hasLocalData()) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        className="flex items-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
      >
        <Upload className="h-4 w-4" />
        Migrate Data
      </button>

      {showDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Migrate to Cloud</h2>
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
                  Your data is currently stored locally on this device. Migrate it to Firestore to sync it across all your devices.
                </p>
                <p className="text-sm text-gray-500 mb-6">
                  This is a one-time migration. Once complete, all changes will automatically sync in real-time.
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
                    {result.migrated.length > 0 && (
                      <ul className="text-sm text-green-800 list-disc list-inside">
                        {result.migrated.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    )}
                    <p className="text-sm text-green-700 mt-2">
                      Your data is now synced! You can access it from any device.
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
                  onClick={migrateData}
                  disabled={migrating}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {migrating ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Migrating...
                    </>
                  ) : (
                    <>
                      <Upload className="h-5 w-5" />
                      Start Migration
                    </>
                  )}
                </button>
              )}
              <button
                onClick={() => {
                  setShowDialog(false);
                  setResult(null);
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
