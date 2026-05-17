namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents an overview of a Scrum sprint as returned by a REST API, 
    /// including key metrics such as sprint name, goal, status, dates, 
    /// capacity, story points, item counts, and burndown data.
    /// </summary>
    public class RestApiScrumSprintOverview
    {
        /// <summary>
        /// Gets or sets the name associated with this scrum.
        /// </summary>
        public string Name { get; set; }

        /// <summary>
        /// Gets or sets the target or the target description.
        /// </summary>
        public string Goal { get; set; }

        /// <summary>
        /// Gets or sets the current status as a string value.
        /// </summary>
        public string Status { get; set; }

        /// <summary>
        /// Gets or sets the start value.
        /// </summary>
        public string Start { get; set; }

        /// <summary>
        /// Gets or sets the end value associated with this scrum.
        /// </summary>
        public string End { get; set; }

        /// <summary>
        /// Gets or sets the total number of days represented by this scrum.
        /// </summary>
        public int DaysTotal { get; set; }

        /// <summary>
        /// Gets or sets the number of days that have elapsed.
        /// </summary>
        public int DaysElapsed { get; set; }

        /// <summary>
        /// Gets or sets the maximum number of elements that can be contained.
        /// </summary>
        public int Capacity { get; set; }

        /// <summary>
        /// Gets or sets the total number of points that have been committed.
        /// </summary>
        public int CommittedPoints { get; set; }

        /// <summary>
        /// Gets or sets the number of points that have been completed.
        /// </summary>
        public int CompletedPoints { get; set; }

        /// <summary>
        /// Gets or sets the total number of items in the collection.
        /// </summary>
        public int TotalItems { get; set; }

        /// <summary>
        /// Gets or sets the number of items that have been completed.
        /// </summary>
        public int CompletedItems { get; set; }

        /// <summary>
        /// Gets or sets the Scrum burndown data associated with the scrum.
        /// </summary>
        public RestApiScrumBurndown Burndown { get; set; }
    }
}
