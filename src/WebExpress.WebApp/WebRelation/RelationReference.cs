using System;

namespace WebExpress.WebApp.WebRelation
{
    /// <summary>
    /// One end of a link. The reference is deliberately a value carried on the
    /// link rather than a foreign key into a table, because the two ends of a
    /// link may live in different systems - one in the application, one behind a
    /// plugin - and the link entity has to describe both without knowing either
    /// storage. The key addresses an item of the application, the uri addresses
    /// anything else; a reference carries whichever of the two its system uses.
    /// </summary>
    public class RelationReference
    {
        /// <summary>
        /// Gets or sets the business key of the referenced item, for example
        /// <c>INC-00123</c>. It is empty for an external reference, which is
        /// addressed by <see cref="Uri"/> alone.
        /// </summary>
        public string Key { get; set; }

        /// <summary>
        /// Gets or sets the class of the referenced item, for example
        /// <c>Incident</c>. A link type restricts the classes it accepts, so the
        /// class travels with the reference and is not looked up again during
        /// validation.
        /// </summary>
        public string Class { get; set; }

        /// <summary>
        /// Gets or sets the display title of the referenced item.
        /// </summary>
        public string Title { get; set; }

        /// <summary>
        /// Gets or sets the address the reference resolves to: the route of the
        /// item for an object reference, the external address for a web link.
        /// </summary>
        public string Uri { get; set; }

        /// <summary>
        /// Gets or sets the workflow state of the referenced item as it is
        /// rendered next to the link, for example <c>Approved</c>. It is a
        /// snapshot for display; the referenced item stays authoritative.
        /// </summary>
        public string Status { get; set; }

        /// <summary>
        /// Gets or sets the semantic color token of <see cref="Status"/>, one of
        /// the framework's contextual names (<c>success</c>, <c>info</c>,
        /// <c>warning</c>, <c>danger</c>, <c>secondary</c>). The token rather
        /// than a color keeps the rendering themeable.
        /// </summary>
        public string StatusColor { get; set; }

        /// <summary>
        /// Determines whether the reference addresses an item of the application
        /// rather than an external address, which decides how it is rendered and
        /// which existence check applies to it.
        /// </summary>
        /// <returns><see langword="true"/> when the reference carries a key.</returns>
        public bool IsObject()
        {
            return !string.IsNullOrWhiteSpace(Key);
        }

        /// <summary>
        /// Returns a copy of the reference, so a link handed to a caller cannot
        /// be mutated through the ends it was built from.
        /// </summary>
        /// <returns>The copy.</returns>
        public RelationReference Clone()
        {
            return new RelationReference
            {
                Key = Key,
                Class = Class,
                Title = Title,
                Uri = Uri,
                Status = Status,
                StatusColor = StatusColor
            };
        }

        /// <summary>
        /// Returns the reference in a form that identifies it in a log or an
        /// error message.
        /// </summary>
        /// <returns>The key, or the uri when the reference is external.</returns>
        public override string ToString()
        {
            return IsObject() ? Key : (Uri ?? string.Empty);
        }
    }
}
