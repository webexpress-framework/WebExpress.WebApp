using System;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebJob;
using WebExpress.WebCore.WebLog;
using WebExpress.WebCore.WebSession;

namespace WebExpress.WebApp.WebJob
{
    /// <summary>
    /// Job for cyclic cleaning of the session. Sessions that are no longer in use will be removed. 
    /// The job starts at 0:30 a.m. on the first day of each month.
    /// </summary>
    [Job("30", "0", "1", "*", "*")]
    public sealed class JobSessionCleaning : IJob
    {
        private readonly IJobContext _jobContext;
        private readonly ISessionManager _sessionManager;
        private readonly ILogManager _logManager;

        /// <summary>
        /// Initialization of the job.
        /// </summary>
        /// <param name="jobContext">The job context, for testing the injection.</param>
        /// <param name="sessionManager">The session manager responsible for session lifecycle.</param>
        /// <param name="logManager">The log manager for logging purposes.</param>
        public JobSessionCleaning(IJobContext jobContext, ISessionManager sessionManager, ILogManager logManager)
        {
            // test the injection
            if (jobContext == null)
            {
                throw new ArgumentNullException(nameof(jobContext), "Parameter cannot be null or empty.");
            }

            if (sessionManager == null)
            {
                throw new ArgumentNullException(nameof(sessionManager), "Parameter cannot be null or empty.");
            }

            if (logManager == null)
            {
                throw new ArgumentNullException(nameof(logManager), "Parameter cannot be null or empty.");
            }

            _jobContext = jobContext;
            _sessionManager = sessionManager;
            _logManager = logManager;
        }

        /// <summary>
        /// Called when the jobs starts working. The call is concurrent.
        /// </summary>
        public void Process()
        {
            _sessionManager.CleanUp(_jobContext.ApplicationContext);
            _logManager.DefaultLog.Info
            (
                message: I18N.Translate("webexpress.webapp:job.sessioncleaning.process", _jobContext.JobId)
            );
        }
    }
}
