using System;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the unpublished draft of a form structure as a store keeps it:
    /// the structure, when it was last written and the revision a draft save has
    /// to present to replace it.
    /// </summary>
    public class RestApiFormEditorDraftItem
    {
        /// <summary>
        /// Gets or sets the drafted structure.
        /// </summary>
        public RestApiFormEditorItem Structure { get; set; }

        /// <summary>
        /// Gets or sets when the draft was last written.
        /// </summary>
        public DateTime? Updated { get; set; }

        /// <summary>
        /// Gets or sets the revision of the draft, which every write moves on.
        /// </summary>
        public int Revision { get; set; }
    }
}
