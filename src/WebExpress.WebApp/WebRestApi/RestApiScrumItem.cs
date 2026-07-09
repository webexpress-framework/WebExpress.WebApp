namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a Scrum item returned or processed by a REST API. 
    /// Contains properties such as identifiers, type, title, priority, status, 
    /// and assignment to a sprint.
    /// </summary>
    public class RestApiScrumItem
    {
        /// <summary>
        /// Gets or sets the unique identifier for this instance.
        /// </summary>
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the type identifier associated with this instance.
        /// </summary>
        public string Type { get; set; }

        /// <summary>
        /// Gets or sets the icon associated with this item.
        /// </summary>
        public string Icon { get; set; }

        /// <summary>
        /// Gets or sets the unique identifier associated with this instance.
        /// </summary>
        public string Key { get; set; }

        /// <summary>
        /// Gets or sets the title associated with this instance.
        /// </summary>
        public string Title { get; set; }

        /// <summary>
        /// Gets or sets the priority level associated with the item.
        /// </summary>
        public string Priority { get; set; }

        /// <summary>
        /// Gets or sets the number of points associated with this instance.
        /// </summary>
        public int Points { get; set; }

        /// <summary>
        /// Gets or sets the unique identifier of the sprint associated with this entity.
        /// </summary>
        public string SprintId { get; set; }

        /// <summary>
        /// Gets or sets the current status as a string value.
        /// </summary>
        public string Status { get; set; }

        /// <summary>
        /// Gets or sets the rank associated with the current instance.
        /// </summary>
        public int Rank { get; set; }

        /// <summary>
        /// Gets or sets the id of the person the item is assigned to, or
        /// <see langword="null"/> when the item is unassigned.
        /// </summary>
        public string AssigneeId { get; set; }

        /// <summary>
        /// Gets or sets the display name of the assignee.
        /// </summary>
        public string AssigneeName { get; set; }

        /// <summary>
        /// Gets or sets the short text shown inside the assignee avatar.
        /// </summary>
        public string AssigneeInitials { get; set; }

        /// <summary>
        /// Gets or sets the CSS color used as the assignee avatar background.
        /// </summary>
        public string AssigneeColor { get; set; }

        /// <summary>
        /// Gets or sets the uri of the assignee avatar image. When present, the
        /// image replaces the initials badge.
        /// </summary>
        public string AssigneeImage { get; set; }
    }
}
