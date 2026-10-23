namespace WebExpress.WebApp.WebRelation
{
    /// <summary>
    /// The outcome of validating a link before it is stored. It carries a code
    /// next to the message so the REST layer answers with a machine readable
    /// reason the client can translate, instead of forcing a caller to match on
    /// prose.
    /// </summary>
    public class RelationValidationResult
    {
        /// <summary>
        /// The code reported when the source of the link cannot be resolved.
        /// </summary>
        public const string UnknownSource = "relation.unknown.source";

        /// <summary>
        /// The code reported when the target of the link cannot be resolved.
        /// </summary>
        public const string UnknownTarget = "relation.unknown.target";

        /// <summary>
        /// The code reported when the link names a system that is not registered.
        /// </summary>
        public const string UnknownSystem = "relation.unknown.system";

        /// <summary>
        /// The code reported when the link names a relation type that is not
        /// registered.
        /// </summary>
        public const string UnknownType = "relation.unknown.type";

        /// <summary>
        /// The code reported when the named system is registered but currently
        /// disabled.
        /// </summary>
        public const string DisabledSystem = "relation.disabled.system";

        /// <summary>
        /// The code reported when the named type is registered but deactivated.
        /// </summary>
        public const string InactiveType = "relation.inactive.type";

        /// <summary>
        /// The code reported when the type is not offered by the named system.
        /// </summary>
        public const string TypeNotInSystem = "relation.type.system.mismatch";

        /// <summary>
        /// The code reported when the class of the target is not accepted by the
        /// type.
        /// </summary>
        public const string TargetClassRejected = "relation.target.class";

        /// <summary>
        /// The code reported when the link would connect an object with itself.
        /// </summary>
        public const string SelfReference = "relation.self";

        /// <summary>
        /// The code reported when the same relation already exists between the
        /// two ends.
        /// </summary>
        public const string Duplicate = "relation.duplicate";

        /// <summary>
        /// The code reported when the cardinality of the type is already
        /// exhausted at one of the two ends.
        /// </summary>
        public const string CardinalityExceeded = "relation.cardinality";

        /// <summary>
        /// The code reported when an external link carries no usable address.
        /// </summary>
        public const string InvalidAddress = "relation.invalid.address";

        /// <summary>
        /// Gets a value indicating whether the link may be stored.
        /// </summary>
        public bool IsValid { get; private set; }

        /// <summary>
        /// Gets the machine readable reason of a rejection, or
        /// <see langword="null"/> when the link is valid.
        /// </summary>
        public string Code { get; private set; }

        /// <summary>
        /// Gets the human readable reason of a rejection, or
        /// <see langword="null"/> when the link is valid.
        /// </summary>
        public string Message { get; private set; }

        /// <summary>
        /// Returns the result of a link that passed every check.
        /// </summary>
        /// <returns>The valid result.</returns>
        public static RelationValidationResult Valid()
        {
            return new RelationValidationResult { IsValid = true };
        }

        /// <summary>
        /// Returns the result of a rejected link.
        /// </summary>
        /// <param name="code">The machine readable reason.</param>
        /// <param name="message">The human readable reason.</param>
        /// <returns>The invalid result.</returns>
        public static RelationValidationResult Invalid(string code, string message)
        {
            return new RelationValidationResult { IsValid = false, Code = code, Message = message };
        }
    }
}
