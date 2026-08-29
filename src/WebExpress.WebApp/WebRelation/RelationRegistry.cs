using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;

namespace WebExpress.WebApp.WebRelation
{
    /// <summary>
    /// The single place that knows which link systems and which relation types
    /// exist. It is the extension point of the hybrid link system: a plugin
    /// registers a system and its types at start-up and they are immediately
    /// available everywhere, because every surface asks this registry rather than
    /// carrying a list of its own. The application itself is never adjusted for a
    /// new relation - it interprets the generic link structure and loads the
    /// types dynamically.
    ///
    /// The two native systems and the eight native types are registered up front,
    /// so an application that adds nothing still links objects and web addresses.
    /// </summary>
    public static class RelationRegistry
    {
        private static readonly ConcurrentDictionary<string, IRelationSystem> _systems = new(StringComparer.OrdinalIgnoreCase);
        private static readonly ConcurrentDictionary<string, IRelationType> _types = new(StringComparer.OrdinalIgnoreCase);

        /// <summary>
        /// Initializes the registry with the systems and types WebExpress ships
        /// natively.
        /// </summary>
        static RelationRegistry()
        {
            RegisterDefaults();
        }

        /// <summary>
        /// Gets the registered link systems, ordered so the native systems come
        /// before the contributed ones and each group stays alphabetical. The
        /// order is the one the add dialog renders its sidebar in.
        /// </summary>
        public static IEnumerable<IRelationSystem> Systems => _systems.Values
            .OrderBy(x => x.Plugin == null ? 0 : 1)
            .ThenBy(x => x.Label ?? x.Id, StringComparer.OrdinalIgnoreCase);

        /// <summary>
        /// Gets the registered relation types in the administered order, with
        /// the id as the tie-break so two servers answer the catalog alike even
        /// when a plugin registered its types without arranging them.
        /// </summary>
        public static IEnumerable<IRelationType> Types => _types.Values
            .OrderBy(x => x.Order)
            .ThenBy(x => x.Id, StringComparer.OrdinalIgnoreCase);

        /// <summary>
        /// Registers a link system, replacing an earlier registration of the same
        /// id so a plugin can refine a shipped system rather than only add to it.
        /// </summary>
        /// <param name="system">The system to register.</param>
        /// <returns>The registered system, or <see langword="null"/> when it carried no id.</returns>
        public static IRelationSystem RegisterSystem(IRelationSystem system)
        {
            if (system == null || string.IsNullOrWhiteSpace(system.Id))
            {
                return null;
            }

            _systems[system.Id] = system;

            return system;
        }

        /// <summary>
        /// Removes a link system. Its types are kept, because the links that
        /// reference them still have to render; validation rejects new links of
        /// the removed system.
        /// </summary>
        /// <param name="id">The id of the system.</param>
        /// <returns><see langword="true"/> when a system was removed.</returns>
        public static bool UnregisterSystem(string id)
        {
            return !string.IsNullOrWhiteSpace(id) && _systems.TryRemove(id, out _);
        }

        /// <summary>
        /// Returns a registered link system.
        /// </summary>
        /// <param name="id">The id of the system.</param>
        /// <returns>The system, or <see langword="null"/> when it is unknown.</returns>
        public static IRelationSystem GetSystem(string id)
        {
            return !string.IsNullOrWhiteSpace(id) && _systems.TryGetValue(id, out var system) ? system : null;
        }

        /// <summary>
        /// Registers a relation type, replacing an earlier registration of the
        /// same id. This is also the path the type administration takes when it
        /// stores an edited type, so an administrator and a plugin write through
        /// the same door.
        /// </summary>
        /// <param name="type">The type to register.</param>
        /// <returns>The registered type, or <see langword="null"/> when it carried no id.</returns>
        public static IRelationType RegisterType(IRelationType type)
        {
            if (type == null || string.IsNullOrWhiteSpace(type.Id))
            {
                return null;
            }

            _types[type.Id] = type;

            return type;
        }

        /// <summary>
        /// Removes a relation type.
        /// </summary>
        /// <param name="id">The id of the type.</param>
        /// <returns><see langword="true"/> when a type was removed.</returns>
        public static bool UnregisterType(string id)
        {
            return !string.IsNullOrWhiteSpace(id) && _types.TryRemove(id, out _);
        }

        /// <summary>
        /// Returns a registered relation type.
        /// </summary>
        /// <param name="id">The id of the type.</param>
        /// <returns>The type, or <see langword="null"/> when it is unknown.</returns>
        public static IRelationType GetType(string id)
        {
            return !string.IsNullOrWhiteSpace(id) && _types.TryGetValue(id, out var type) ? type : null;
        }

        /// <summary>
        /// Returns the types a system offers: the types that name it, narrowed to
        /// the selection the system declares when it declares one.
        /// </summary>
        /// <param name="systemId">The id of the system.</param>
        /// <param name="activeOnly">Whether deactivated types are left out.</param>
        /// <returns>The offered types.</returns>
        public static IEnumerable<IRelationType> TypesOf(string systemId, bool activeOnly = false)
        {
            var system = GetSystem(systemId);
            var offered = system?.Types?.ToList() ?? [];

            return Types
                .Where(x => string.Equals(x.System, systemId, StringComparison.OrdinalIgnoreCase))
                .Where(x => offered.Count == 0 || offered.Contains(x.Id, StringComparer.OrdinalIgnoreCase))
                .Where(x => !activeOnly || x.Active);
        }

        /// <summary>
        /// Validates a link against the registry and, when the caller supplies
        /// them, against the links that already exist. The check is deliberately
        /// separated from storage: the entity layer knows the rules, the endpoint
        /// knows where the links live and passes both an existence resolver and
        /// the neighbourhood of the two ends.
        /// </summary>
        /// <param name="link">The link to validate.</param>
        /// <param name="exists">
        /// Resolves whether a referenced object exists. When absent, the
        /// existence of the two ends is not checked, which is what an endpoint
        /// that already resolved them passes.
        /// </param>
        /// <param name="existing">
        /// The links that already touch either end, used for the duplicate and
        /// the cardinality check. When absent, both checks are skipped.
        /// </param>
        /// <returns>The outcome.</returns>
        public static RelationValidationResult Validate(Relation link, Func<RelationReference, bool> exists = null, IEnumerable<Relation> existing = null)
        {
            if (link == null)
            {
                return RelationValidationResult.Invalid(RelationValidationResult.UnknownSource, "the link is missing.");
            }

            if (link.Source == null || !link.Source.IsObject())
            {
                return RelationValidationResult.Invalid(RelationValidationResult.UnknownSource, "the link carries no source object.");
            }

            var system = GetSystem(link.System);
            if (system == null)
            {
                return RelationValidationResult.Invalid(RelationValidationResult.UnknownSystem, $"the link system '{link.System}' is not registered.");
            }

            if (!system.Enabled)
            {
                return RelationValidationResult.Invalid(RelationValidationResult.DisabledSystem, $"the link system '{link.System}' is disabled.");
            }

            var type = GetType(link.Type);
            if (type == null)
            {
                return RelationValidationResult.Invalid(RelationValidationResult.UnknownType, $"the link type '{link.Type}' is not registered.");
            }

            if (!type.Active)
            {
                return RelationValidationResult.Invalid(RelationValidationResult.InactiveType, $"the link type '{link.Type}' is deactivated.");
            }

            if (!TypesOf(system.Id).Any(x => string.Equals(x.Id, type.Id, StringComparison.OrdinalIgnoreCase)))
            {
                return RelationValidationResult.Invalid(RelationValidationResult.TypeNotInSystem, $"the link type '{type.Id}' is not offered by the system '{system.Id}'.");
            }

            var targetResult = ValidateTarget(link, system, type, exists);
            if (!targetResult.IsValid)
            {
                return targetResult;
            }

            if (exists != null && !exists(link.Source))
            {
                return RelationValidationResult.Invalid(RelationValidationResult.UnknownSource, $"the source '{link.Source}' does not exist.");
            }

            return existing == null
                ? RelationValidationResult.Valid()
                : ValidateNeighbourhood(link, type, existing);
        }

        /// <summary>
        /// Restores the registry to the systems and types WebExpress ships
        /// natively, which is what a test isolates itself with and what an
        /// application calls after unloading its plugins.
        /// </summary>
        public static void Reset()
        {
            _systems.Clear();
            _types.Clear();

            RegisterDefaults();
        }

        /// <summary>
        /// Registers the two native systems and the eight native relation types.
        /// The labels are i18n keys rather than prose, so the same catalog reads
        /// in the language of the request.
        /// </summary>
        private static void RegisterDefaults()
        {
            RegisterSystem(new RelationSystem
            {
                Id = RelationSystem.Object,
                Label = "webexpress.webapp:relation.system.object.label",
                Description = "webexpress.webapp:relation.system.object.description",
                Kind = RelationKind.Object,
                Badge = "OBJ",
                Color = "#e8543f"
            });

            RegisterSystem(new RelationSystem
            {
                Id = RelationSystem.Web,
                Label = "webexpress.webapp:relation.system.web.label",
                Description = "webexpress.webapp:relation.system.web.description",
                Kind = RelationKind.External,
                Badge = "WEB",
                Color = "#3b4453"
            });

            RegisterType(new RelationType
            {
                Id = RelationType.Blocks,
                Icon = "flag",
                Order = 1,
                Label = "webexpress.webapp:relation.type.blocks.label",
                InverseLabel = "webexpress.webapp:relation.type.blocks.inverse",
                Description = "webexpress.webapp:relation.type.blocks.description",
                Cardinality = RelationCardinality.ManyToMany,
                Effect = RelationEffect.BlocksCompletion
            });

            RegisterType(new RelationType
            {
                Id = RelationType.Causes,
                Icon = "bolt",
                Order = 2,
                Label = "webexpress.webapp:relation.type.causes.label",
                InverseLabel = "webexpress.webapp:relation.type.causes.inverse",
                Description = "webexpress.webapp:relation.type.causes.description",
                Cardinality = RelationCardinality.OneToMany
            });

            RegisterType(new RelationType
            {
                Id = RelationType.References,
                Icon = "file",
                Order = 3,
                Label = "webexpress.webapp:relation.type.references.label",
                InverseLabel = "webexpress.webapp:relation.type.references.inverse",
                Description = "webexpress.webapp:relation.type.references.description",
                Cardinality = RelationCardinality.ManyToMany
            });

            RegisterType(new RelationType
            {
                Id = RelationType.Similar,
                Icon = "clone",
                Order = 4,
                Label = "webexpress.webapp:relation.type.similar.label",
                InverseLabel = "webexpress.webapp:relation.type.similar.label",
                Description = "webexpress.webapp:relation.type.similar.description",
                Symmetric = true,
                Cardinality = RelationCardinality.ManyToMany
            });

            RegisterType(new RelationType
            {
                Id = RelationType.Duplicate,
                Icon = "copy",
                Order = 5,
                Label = "webexpress.webapp:relation.type.duplicate.label",
                InverseLabel = "webexpress.webapp:relation.type.duplicate.inverse",
                Description = "webexpress.webapp:relation.type.duplicate.description",
                Cardinality = RelationCardinality.ManyToOne,
                Effect = RelationEffect.ClosesItem
            });

            RegisterType(new RelationType
            {
                Id = RelationType.Parent,
                Icon = "sitemap",
                Order = 6,
                Label = "webexpress.webapp:relation.type.parent.label",
                InverseLabel = "webexpress.webapp:relation.type.parent.inverse",
                Description = "webexpress.webapp:relation.type.parent.description",
                Cardinality = RelationCardinality.OneToMany,
                Effect = RelationEffect.AggregatesProgress
            });

            RegisterType(new RelationType
            {
                Id = RelationType.Replaces,
                Icon = "arrow-right-arrow-left",
                Order = 7,
                Label = "webexpress.webapp:relation.type.replaces.label",
                InverseLabel = "webexpress.webapp:relation.type.replaces.inverse",
                Description = "webexpress.webapp:relation.type.replaces.description",
                Cardinality = RelationCardinality.OneToOne
            });

            RegisterType(new RelationType
            {
                Id = RelationType.WebLink,
                Icon = "arrow-up-right-from-square",
                Order = 8,
                Label = "webexpress.webapp:relation.type.weblink.label",
                Description = "webexpress.webapp:relation.type.weblink.description",
                System = RelationSystem.Web,
                Cardinality = RelationCardinality.ManyToMany
            });
        }

        /// <summary>
        /// Checks the target end against the addressing of its system and the
        /// classes its type accepts.
        /// </summary>
        /// <param name="link">The link to validate.</param>
        /// <param name="system">The resolved system.</param>
        /// <param name="type">The resolved type.</param>
        /// <param name="exists">The existence resolver, may be absent.</param>
        /// <returns>The outcome.</returns>
        private static RelationValidationResult ValidateTarget(Relation link, IRelationSystem system, IRelationType type, Func<RelationReference, bool> exists)
        {
            if (system.Kind == RelationKind.External)
            {
                return IsAddress(link.Target?.Uri)
                    ? RelationValidationResult.Valid()
                    : RelationValidationResult.Invalid(RelationValidationResult.InvalidAddress, "the external link carries no absolute address.");
            }

            if (link.Target == null || !link.Target.IsObject())
            {
                return RelationValidationResult.Invalid(RelationValidationResult.UnknownTarget, "the link carries no target object.");
            }

            if (string.Equals(link.Source.Key, link.Target.Key, StringComparison.OrdinalIgnoreCase))
            {
                return RelationValidationResult.Invalid(RelationValidationResult.SelfReference, "an object cannot be linked with itself.");
            }

            var accepted = type.TargetClasses?.ToList() ?? [];
            if (accepted.Count > 0 && !accepted.Contains(link.Target.Class, StringComparer.OrdinalIgnoreCase))
            {
                return RelationValidationResult.Invalid(RelationValidationResult.TargetClassRejected, $"the type '{type.Id}' does not accept the class '{link.Target.Class}'.");
            }

            if (exists != null && !exists(link.Target))
            {
                return RelationValidationResult.Invalid(RelationValidationResult.UnknownTarget, $"the target '{link.Target}' does not exist.");
            }

            return RelationValidationResult.Valid();
        }

        /// <summary>
        /// Checks the link against the links that already touch its two ends: the
        /// same relation must not be stored twice, and the cardinality of the
        /// type must still allow one more at either end.
        /// </summary>
        /// <param name="link">The link to validate.</param>
        /// <param name="type">The resolved type.</param>
        /// <param name="existing">The links already touching either end.</param>
        /// <returns>The outcome.</returns>
        private static RelationValidationResult ValidateNeighbourhood(Relation link, IRelationType type, IEnumerable<Relation> existing)
        {
            var relevant = existing
                .Where(x => x != null && x.Status != RelationStatus.Obsolete)
                .Where(x => !string.Equals(x.Id, link.Id, StringComparison.OrdinalIgnoreCase))
                .Where(x => string.Equals(x.Type, link.Type, StringComparison.OrdinalIgnoreCase))
                .ToList();

            if (relevant.Any(x => SameEnds(x, link)))
            {
                return RelationValidationResult.Invalid(RelationValidationResult.Duplicate, "the same link already exists.");
            }

            var fromSource = relevant.Count(x => string.Equals(x.Source?.Key, link.Source.Key, StringComparison.OrdinalIgnoreCase));
            if (fromSource >= MaxPerSource(type.Cardinality))
            {
                return RelationValidationResult.Invalid(RelationValidationResult.CardinalityExceeded, $"the source already holds the maximum number of '{type.Id}' links.");
            }

            var identity = Identity(link.Target);
            var toTarget = relevant.Count(x => string.Equals(Identity(x.Target), identity, StringComparison.OrdinalIgnoreCase));
            if (toTarget >= MaxPerTarget(type.Cardinality))
            {
                return RelationValidationResult.Invalid(RelationValidationResult.CardinalityExceeded, $"the target already holds the maximum number of '{type.Id}' links.");
            }

            return RelationValidationResult.Valid();
        }

        /// <summary>
        /// Determines whether two links connect the same two ends, which is what
        /// makes the second one a duplicate. A symmetric or bidirectional link is
        /// the same relation read the other way round, so the ends are compared
        /// unordered for those.
        /// </summary>
        /// <param name="left">The stored link.</param>
        /// <param name="right">The link to be stored.</param>
        /// <returns><see langword="true"/> when both describe the same relation.</returns>
        private static bool SameEnds(Relation left, Relation right)
        {
            var forward = string.Equals(Identity(left.Source), Identity(right.Source), StringComparison.OrdinalIgnoreCase)
                && string.Equals(Identity(left.Target), Identity(right.Target), StringComparison.OrdinalIgnoreCase);

            if (forward || right.Direction != RelationDirection.Bidirectional)
            {
                return forward;
            }

            return string.Equals(Identity(left.Source), Identity(right.Target), StringComparison.OrdinalIgnoreCase)
                && string.Equals(Identity(left.Target), Identity(right.Source), StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// Returns the value that identifies an end across the two addressing
        /// schemes, so an object end and an external end are compared through one
        /// expression.
        /// </summary>
        /// <param name="reference">The end.</param>
        /// <returns>The identity, or an empty string when the end is absent.</returns>
        private static string Identity(RelationReference reference)
        {
            return reference == null ? string.Empty : (reference.IsObject() ? reference.Key : reference.Uri ?? string.Empty);
        }

        /// <summary>
        /// Returns how many links of a cardinality one source may hold.
        /// </summary>
        /// <param name="cardinality">The cardinality of the type.</param>
        /// <returns>The maximum.</returns>
        private static int MaxPerSource(RelationCardinality cardinality)
        {
            return cardinality is RelationCardinality.OneToOne or RelationCardinality.ManyToOne ? 1 : int.MaxValue;
        }

        /// <summary>
        /// Returns how many links of a cardinality one target may receive.
        /// </summary>
        /// <param name="cardinality">The cardinality of the type.</param>
        /// <returns>The maximum.</returns>
        private static int MaxPerTarget(RelationCardinality cardinality)
        {
            return cardinality is RelationCardinality.OneToOne or RelationCardinality.OneToMany ? 1 : int.MaxValue;
        }

        /// <summary>
        /// Determines whether a string is an absolute address an external link
        /// can resolve. Only http and https are accepted, because the address is
        /// rendered as a link the user follows.
        /// </summary>
        /// <param name="value">The candidate address.</param>
        /// <returns><see langword="true"/> when the address is usable.</returns>
        private static bool IsAddress(string value)
        {
            return !string.IsNullOrWhiteSpace(value)
                && Uri.TryCreate(value, UriKind.Absolute, out var uri)
                && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
        }
    }
}
