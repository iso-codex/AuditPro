import { supabase } from './supabaseClient';

/**
 * Logs an action to the database audit_log table.
 * Used for critical events that aren't automatically captured by database triggers.
 * 
 * @param {string} actionType - E.g., 'USER_LOGIN', 'REQUISITION_APPROVED', 'SETTINGS_CHANGED'
 * @param {string} departmentId - Optional department context
 * @param {string} notes - Detailed description of the action
 */
export const logAction = async (actionType, departmentId = null, notes = '') => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; // Silent fail if not authenticated

    const { error } = await supabase
      .from('audit_log')
      .insert({
        actor_id: session.user.id,
        action_type: actionType,
        department: departmentId, // This field is technically text in the DB, though it should be UUID. We pass it as-is.
        notes: notes
      });

    if (error) {
      console.warn("Failed to write to audit log:", error);
    }
  } catch (err) {
    console.warn("Error in logAction logger:", err);
  }
};

/**
 * Global Error Logger (Simulated Sentry)
 * In production, this would initialize Sentry.init()
 */
export const initErrorTracking = () => {
  window.addEventListener('error', (event) => {
    console.error('[ErrorTracker] Caught global error:', event.message, event.filename, event.lineno);
    // Future: Sentry.captureException(event.error);
    
    // Attempt to log critical frontend crashes to DB if we have a session
    if (event.message?.includes('ResizeObserver')) return; // Ignore benign errors
    
    logAction('FRONTEND_CRASH', null, `Error: ${event.message} at ${event.filename}:${event.lineno}`)
      .catch(() => {}); // Fire and forget
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('[ErrorTracker] Caught unhandled promise rejection:', event.reason);
    // Future: Sentry.captureException(event.reason);
    
    logAction('UNHANDLED_REJECTION', null, `Reason: ${event.reason}`)
      .catch(() => {}); // Fire and forget
  });
};
