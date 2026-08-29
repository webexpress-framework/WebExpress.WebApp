using System;
using WebExpress.WebApp.WebRelation;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// The wire vocabulary of the link endpoints. The enumerations of the link
    /// model travel as stable tokens rather than as ordinals, so a stored link
    /// survives a reordering of an enumeration and the client reads the same
    /// words the administration surface shows - the cardinality tokens are
    /// literally the <c>n:n</c> notation the type table renders.
    /// </summary>
    internal static class RestApiRelationWire
    {
        /// <summary>
        /// Returns the wire token of a direction.
        /// </summary>
        /// <param name="direction">The direction.</param>
        /// <returns>The token.</returns>
        public static string Token(RelationDirection direction)
        {
            return direction == RelationDirection.Unidirectional ? "unidirectional" : "bidirectional";
        }

        /// <summary>
        /// Returns the wire token of a status.
        /// </summary>
        /// <param name="status">The status.</param>
        /// <returns>The token.</returns>
        public static string Token(RelationStatus status)
        {
            return status switch
            {
                RelationStatus.Confirmed => "confirmed",
                RelationStatus.Obsolete => "obsolete",
                _ => "active"
            };
        }

        /// <summary>
        /// Returns the wire token of a kind.
        /// </summary>
        /// <param name="kind">The kind.</param>
        /// <returns>The token.</returns>
        public static string Token(RelationKind kind)
        {
            return kind == RelationKind.External ? "external" : "object";
        }

        /// <summary>
        /// Returns the wire token of a cardinality, in the notation the type
        /// administration renders.
        /// </summary>
        /// <param name="cardinality">The cardinality.</param>
        /// <returns>The token.</returns>
        public static string Token(RelationCardinality cardinality)
        {
            return cardinality switch
            {
                RelationCardinality.OneToOne => "1:1",
                RelationCardinality.OneToMany => "1:n",
                RelationCardinality.ManyToOne => "n:1",
                _ => "n:n"
            };
        }

        /// <summary>
        /// Returns the wire token of a workflow effect.
        /// </summary>
        /// <param name="effect">The effect.</param>
        /// <returns>The token.</returns>
        public static string Token(RelationEffect effect)
        {
            return effect switch
            {
                RelationEffect.BlocksCompletion => "blocksCompletion",
                RelationEffect.ClosesItem => "closesItem",
                RelationEffect.AggregatesProgress => "aggregatesProgress",
                _ => "none"
            };
        }

        /// <summary>
        /// Reads a direction token, falling back to the bidirectional default a
        /// link carries when the client says nothing.
        /// </summary>
        /// <param name="token">The token.</param>
        /// <returns>The direction.</returns>
        public static RelationDirection Direction(string token)
        {
            return string.Equals(token, "unidirectional", StringComparison.OrdinalIgnoreCase)
                ? RelationDirection.Unidirectional
                : RelationDirection.Bidirectional;
        }

        /// <summary>
        /// Reads a status token, falling back to active.
        /// </summary>
        /// <param name="token">The token.</param>
        /// <returns>The status.</returns>
        public static RelationStatus Status(string token)
        {
            if (string.Equals(token, "confirmed", StringComparison.OrdinalIgnoreCase))
            {
                return RelationStatus.Confirmed;
            }

            return string.Equals(token, "obsolete", StringComparison.OrdinalIgnoreCase)
                ? RelationStatus.Obsolete
                : RelationStatus.Active;
        }

        /// <summary>
        /// Reads a kind token, falling back to the object kind.
        /// </summary>
        /// <param name="token">The token.</param>
        /// <returns>The kind.</returns>
        public static RelationKind Kind(string token)
        {
            return string.Equals(token, "external", StringComparison.OrdinalIgnoreCase)
                ? RelationKind.External
                : RelationKind.Object;
        }

        /// <summary>
        /// Reads a cardinality token, falling back to the unrestricted default.
        /// </summary>
        /// <param name="token">The token.</param>
        /// <returns>The cardinality.</returns>
        public static RelationCardinality Cardinality(string token)
        {
            return token switch
            {
                "1:1" => RelationCardinality.OneToOne,
                "1:n" => RelationCardinality.OneToMany,
                "n:1" => RelationCardinality.ManyToOne,
                _ => RelationCardinality.ManyToMany
            };
        }

        /// <summary>
        /// Reads an effect token, falling back to no effect.
        /// </summary>
        /// <param name="token">The token.</param>
        /// <returns>The effect.</returns>
        public static RelationEffect Effect(string token)
        {
            return token switch
            {
                "blocksCompletion" => RelationEffect.BlocksCompletion,
                "closesItem" => RelationEffect.ClosesItem,
                "aggregatesProgress" => RelationEffect.AggregatesProgress,
                _ => RelationEffect.None
            };
        }
    }
}
