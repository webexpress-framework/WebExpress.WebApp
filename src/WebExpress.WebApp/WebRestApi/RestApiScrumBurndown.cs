namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a data model for storing ideal and actual values used 
    /// in Scrum burndown chart calculations.
    /// </summary>
    public class RestApiScrumBurndown
    {
        /// <summary>
        /// Gets or sets the ideal output values for the current instance.
        /// </summary>
        public double[] Ideal { get; set; }

        /// <summary>
        /// Gets or sets the actual values used for comparison or evaluation.
        /// </summary>
        public double[] Actual { get; set; }
    }
}
