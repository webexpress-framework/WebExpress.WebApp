using System;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Stores information about failed login attempts for a user.
    /// </summary>
    public class RestApiSessionFailedAttemptInfo
    {
        /// <summary>
        /// Gets or sets the number of failed attempts.
        /// </summary>
        public int Count { get; set; }

        /// <summary>
        /// Gets or sets the timestamp of the last failed attempt.
        /// </summary>
        public DateTime LastAttempt { get; set; }
    }
}
