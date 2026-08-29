using WebExpress.WebApp.WebRelation;

namespace WebExpress.WebApp.Test.WebLink
{
    /// <summary>
    /// Tests the registry of link systems and relation types, and with it the
    /// rules a link is validated against. The registry is process wide, so the
    /// tests run in the non parallel collection and restore the shipped catalog
    /// afterwards.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestRelationRegistry : IDisposable
    {
        /// <summary>
        /// Restores the shipped catalog, so a test that registered its own
        /// system or type cannot influence the next one.
        /// </summary>
        public void Dispose()
        {
            RelationRegistry.Reset();
            GC.SuppressFinalize(this);
        }

        /// <summary>
        /// The two natively supported link systems are available without any
        /// registration by the application.
        /// </summary>
        [Fact]
        public void NativeSystems_AreRegistered()
        {
            // act
            var linkObject = RelationRegistry.GetSystem(RelationSystem.Object);
            var web = RelationRegistry.GetSystem(RelationSystem.Web);

            // validation
            Assert.NotNull(linkObject);
            Assert.Equal(RelationKind.Object, linkObject.Kind);
            Assert.NotNull(web);
            Assert.Equal(RelationKind.External, web.Kind);
        }

        /// <summary>
        /// The eight natively supported relations are available, each of them
        /// offered by the system it belongs to.
        /// </summary>
        [Fact]
        public void NativeTypes_AreOfferedByTheirSystem()
        {
            // act
            var objectTypes = RelationRegistry.TypesOf(RelationSystem.Object).Select(x => x.Id).ToList();
            var webTypes = RelationRegistry.TypesOf(RelationSystem.Web).Select(x => x.Id).ToList();

            // validation
            Assert.Equal(
                [RelationType.Blocks, RelationType.Causes, RelationType.References, RelationType.Similar, RelationType.Duplicate, RelationType.Parent, RelationType.Replaces],
                objectTypes);
            Assert.Equal([RelationType.WebLink], webTypes);
        }

        /// <summary>
        /// The catalog follows the administered order rather than the order the
        /// types happened to be registered in, so every surface lists the
        /// relations the way an administrator arranged them.
        /// </summary>
        [Fact]
        public void Types_FollowTheAdministeredOrder()
        {
            // arrange
            RelationRegistry.RegisterType(new RelationType { Id = "aaa-late", Label = "late", InverseLabel = "late", Order = 99 });

            // act
            var order = RelationRegistry.Types.Select(x => x.Id).ToList();

            // validation
            Assert.Equal(RelationType.Blocks, order[0]);
            Assert.Equal("aaa-late", order[^1]);
        }

        /// <summary>
        /// A plugin registers a system and its relations at start-up and they
        /// are immediately part of the catalog, which is what makes the link
        /// system extensible without a change to the application.
        /// </summary>
        [Fact]
        public void RegisterSystem_MakesTheSystemAndItsTypesAvailable()
        {
            // arrange
            RelationRegistry.RegisterSystem(new RelationSystem
            {
                Id = "acme.github",
                Label = "GitHub",
                Kind = RelationKind.Object,
                Plugin = "acme.github",
                Version = "1.4.0"
            });
            RelationRegistry.RegisterType(new RelationType
            {
                Id = "gh.pull",
                Label = "pull request",
                InverseLabel = "belongs to",
                System = "acme.github"
            });

            // act
            var types = RelationRegistry.TypesOf("acme.github").Select(x => x.Id).ToList();

            // validation
            Assert.Equal(["gh.pull"], types);
            Assert.Contains(RelationRegistry.Systems, x => x.Id == "acme.github");
        }

        /// <summary>
        /// The contributed systems are listed after the ones the application
        /// itself brings, which is the order the add dialog groups its sidebar
        /// by.
        /// </summary>
        [Fact]
        public void Systems_ListTheNativeOnesFirst()
        {
            // arrange
            RelationRegistry.RegisterSystem(new RelationSystem { Id = "acme.a", Label = "AAA", Plugin = "acme" });

            // act
            var systems = RelationRegistry.Systems.ToList();

            // validation
            Assert.Null(systems[0].Plugin);
            Assert.Equal("acme.a", systems[^1].Id);
        }

        /// <summary>
        /// A system may narrow the relations it offers to a selection of the
        /// ones that name it.
        /// </summary>
        [Fact]
        public void TypesOf_HonoursTheSelectionOfTheSystem()
        {
            // arrange
            var system = new RelationSystem { Id = "acme.narrow" };
            system.Types.Add("acme.one");
            RelationRegistry.RegisterSystem(system);
            RelationRegistry.RegisterType(new RelationType { Id = "acme.one", Label = "one", InverseLabel = "one", System = "acme.narrow" });
            RelationRegistry.RegisterType(new RelationType { Id = "acme.two", Label = "two", InverseLabel = "two", System = "acme.narrow" });

            // act
            var types = RelationRegistry.TypesOf("acme.narrow").Select(x => x.Id).ToList();

            // validation
            Assert.Equal(["acme.one"], types);
        }

        /// <summary>
        /// A deactivated relation keeps rendering its existing links but is no
        /// longer offered, which is how a relation is retired without rewriting
        /// history.
        /// </summary>
        [Fact]
        public void TypesOf_ActiveOnly_LeavesOutTheRetiredRelations()
        {
            // arrange
            RelationRegistry.RegisterType(new RelationType { Id = RelationType.Replaces, Label = "replaces", InverseLabel = "is replaced by", Active = false });

            // act
            var all = RelationRegistry.TypesOf(RelationSystem.Object).Select(x => x.Id).ToList();
            var offered = RelationRegistry.TypesOf(RelationSystem.Object, activeOnly: true).Select(x => x.Id).ToList();

            // validation
            Assert.Contains(RelationType.Replaces, all);
            Assert.DoesNotContain(RelationType.Replaces, offered);
        }

        /// <summary>
        /// A valid object link passes every check.
        /// </summary>
        [Fact]
        public void Validate_AcceptsAnObjectLink()
        {
            // arrange
            var link = ObjectLink("INC-1", "CHG-1", RelationType.Blocks);

            // act
            var result = RelationRegistry.Validate(link, _ => true, []);

            // validation
            Assert.True(result.IsValid);
        }

        /// <summary>
        /// A link whose system or relation is not registered is refused, which
        /// is the check that keeps a typo or a removed plugin from producing a
        /// link nothing can interpret.
        /// </summary>
        [Theory]
        [InlineData("nonsense", RelationType.Blocks, RelationValidationResult.UnknownSystem)]
        [InlineData(RelationSystem.Object, "nonsense", RelationValidationResult.UnknownType)]
        public void Validate_RefusesAnUnregisteredSystemOrType(string system, string type, string expected)
        {
            // arrange
            var link = ObjectLink("INC-1", "CHG-1", type);
            link.System = system;

            // act
            var result = RelationRegistry.Validate(link, _ => true, []);

            // validation
            Assert.False(result.IsValid);
            Assert.Equal(expected, result.Code);
        }

        /// <summary>
        /// A relation of one system cannot be used in another, so a plugin
        /// relation cannot silently be attached to a native link.
        /// </summary>
        [Fact]
        public void Validate_RefusesATypeOfAnotherSystem()
        {
            // arrange
            var link = ObjectLink("INC-1", "CHG-1", RelationType.WebLink);

            // act
            var result = RelationRegistry.Validate(link, _ => true, []);

            // validation
            Assert.False(result.IsValid);
            Assert.Equal(RelationValidationResult.TypeNotInSystem, result.Code);
        }

        /// <summary>
        /// A disabled system and a deactivated relation are both refused for a
        /// new link, while their existing links stay untouched.
        /// </summary>
        [Fact]
        public void Validate_RefusesADisabledSystemAndADeactivatedType()
        {
            // arrange
            RelationRegistry.RegisterSystem(new RelationSystem { Id = RelationSystem.Object, Kind = RelationKind.Object, Enabled = false });
            var link = ObjectLink("INC-1", "CHG-1", RelationType.Blocks);

            // act
            var disabled = RelationRegistry.Validate(link, _ => true, []);

            RelationRegistry.RegisterSystem(new RelationSystem { Id = RelationSystem.Object, Kind = RelationKind.Object });
            RelationRegistry.RegisterType(new RelationType { Id = RelationType.Blocks, Label = "blocks", InverseLabel = "is blocked by", Active = false });
            var inactive = RelationRegistry.Validate(link, _ => true, []);

            // validation
            Assert.Equal(RelationValidationResult.DisabledSystem, disabled.Code);
            Assert.Equal(RelationValidationResult.InactiveType, inactive.Code);
        }

        /// <summary>
        /// Both ends are resolved, so a link can never be stored against a key
        /// that was mistyped or an object that was meanwhile deleted.
        /// </summary>
        [Fact]
        public void Validate_ResolvesBothEnds()
        {
            // arrange
            var link = ObjectLink("INC-1", "CHG-1", RelationType.Blocks);

            // act
            var missingTarget = RelationRegistry.Validate(link, reference => reference.Key == "INC-1", []);
            var missingSource = RelationRegistry.Validate(link, reference => reference.Key == "CHG-1", []);

            // validation
            Assert.Equal(RelationValidationResult.UnknownTarget, missingTarget.Code);
            Assert.Equal(RelationValidationResult.UnknownSource, missingSource.Code);
        }

        /// <summary>
        /// An object cannot be linked with itself.
        /// </summary>
        [Fact]
        public void Validate_RefusesASelfReference()
        {
            // arrange
            var link = ObjectLink("INC-1", "INC-1", RelationType.Blocks);

            // act
            var result = RelationRegistry.Validate(link, _ => true, []);

            // validation
            Assert.Equal(RelationValidationResult.SelfReference, result.Code);
        }

        /// <summary>
        /// A relation that is narrowed to certain classes refuses a target of
        /// another one.
        /// </summary>
        [Fact]
        public void Validate_HonoursTheAcceptedTargetClasses()
        {
            // arrange
            var type = new RelationType { Id = "narrow", Label = "narrow", InverseLabel = "narrow" };
            type.TargetClasses.Add("Change");
            RelationRegistry.RegisterType(type);

            var accepted = ObjectLink("INC-1", "CHG-1", "narrow");
            accepted.Target.Class = "Change";

            var rejected = ObjectLink("INC-1", "DOC-1", "narrow");
            rejected.Target.Class = "Document";

            // act & validation
            Assert.True(RelationRegistry.Validate(accepted, _ => true, []).IsValid);
            Assert.Equal(RelationValidationResult.TargetClassRejected, RelationRegistry.Validate(rejected, _ => true, []).Code);
        }

        /// <summary>
        /// The same relation between the same two objects is not stored twice.
        /// </summary>
        [Fact]
        public void Validate_RefusesADuplicate()
        {
            // arrange
            var stored = ObjectLink("INC-1", "CHG-1", RelationType.Blocks);
            stored.Id = "stored";
            var candidate = ObjectLink("INC-1", "CHG-1", RelationType.Blocks);

            // act
            var result = RelationRegistry.Validate(candidate, _ => true, [stored]);

            // validation
            Assert.Equal(RelationValidationResult.Duplicate, result.Code);
        }

        /// <summary>
        /// A bidirectional relation is one fact told from two sides, so
        /// establishing it the other way round is the same duplicate.
        /// </summary>
        [Fact]
        public void Validate_RecognisesADuplicateReadFromTheOtherEnd()
        {
            // arrange
            var stored = ObjectLink("CHG-1", "INC-1", RelationType.Blocks);
            stored.Id = "stored";
            var candidate = ObjectLink("INC-1", "CHG-1", RelationType.Blocks);

            // act
            var result = RelationRegistry.Validate(candidate, _ => true, [stored]);

            // validation
            Assert.Equal(RelationValidationResult.Duplicate, result.Code);
        }

        /// <summary>
        /// A link that is being edited does not collide with its own stored
        /// version.
        /// </summary>
        [Fact]
        public void Validate_IgnoresTheStoredVersionOfTheLinkItself()
        {
            // arrange
            var stored = ObjectLink("INC-1", "CHG-1", RelationType.Blocks);
            stored.Id = "l1";
            var edited = ObjectLink("INC-1", "CHG-1", RelationType.Blocks);
            edited.Id = "l1";

            // act
            var result = RelationRegistry.Validate(edited, _ => true, [stored]);

            // validation
            Assert.True(result.IsValid);
        }

        /// <summary>
        /// A relation that stopped holding no longer occupies its slot, so the
        /// same link may be established again after it was retired.
        /// </summary>
        [Fact]
        public void Validate_IgnoresObsoleteLinks()
        {
            // arrange
            var stored = ObjectLink("INC-1", "CHG-1", RelationType.Blocks);
            stored.Id = "stored";
            stored.Status = RelationStatus.Obsolete;

            // act
            var result = RelationRegistry.Validate(ObjectLink("INC-1", "CHG-1", RelationType.Blocks), _ => true, [stored]);

            // validation
            Assert.True(result.IsValid);
        }

        /// <summary>
        /// A relation that is meaningful only once cannot be established twice
        /// from the same source, which is what the n:1 cardinality of the
        /// duplicate relation states.
        /// </summary>
        [Fact]
        public void Validate_EnforcesTheCardinalityOnTheSource()
        {
            // arrange
            var stored = ObjectLink("BUG-1", "BUG-2", RelationType.Duplicate);
            stored.Id = "stored";

            // act
            var result = RelationRegistry.Validate(ObjectLink("BUG-1", "BUG-3", RelationType.Duplicate), _ => true, [stored]);

            // validation
            Assert.Equal(RelationValidationResult.CardinalityExceeded, result.Code);
        }

        /// <summary>
        /// A child has exactly one parent, which is what the 1:n cardinality of
        /// the parent relation states about its target end.
        /// </summary>
        [Fact]
        public void Validate_EnforcesTheCardinalityOnTheTarget()
        {
            // arrange
            var stored = ObjectLink("PRJ-1", "TSK-1", RelationType.Parent);
            stored.Id = "stored";

            // act
            var second = RelationRegistry.Validate(ObjectLink("PRJ-2", "TSK-1", RelationType.Parent), _ => true, [stored]);
            var sibling = RelationRegistry.Validate(ObjectLink("PRJ-1", "TSK-2", RelationType.Parent), _ => true, [stored]);

            // validation
            Assert.Equal(RelationValidationResult.CardinalityExceeded, second.Code);
            Assert.True(sibling.IsValid, "a parent may hold many children");
        }

        /// <summary>
        /// A web link is addressed by its uri, and only an address the user can
        /// actually follow is accepted.
        /// </summary>
        [Theory]
        [InlineData("https://example.com/advisory", true)]
        [InlineData("http://example.com", true)]
        [InlineData("javascript:alert(1)", false)]
        [InlineData("example.com", false)]
        [InlineData(null, false)]
        public void Validate_AcceptsOnlyAWebAddressForAWebLink(string address, bool expected)
        {
            // arrange
            var link = new Relation
            {
                System = RelationSystem.Web,
                Type = RelationType.WebLink,
                Source = new RelationReference { Key = "INC-1", Class = "Incident" },
                Target = new RelationReference { Uri = address, Title = "advisory" }
            };

            // act
            var result = RelationRegistry.Validate(link, _ => true, []);

            // validation
            Assert.Equal(expected, result.IsValid);

            if (!expected)
            {
                Assert.Equal(RelationValidationResult.InvalidAddress, result.Code);
            }
        }

        /// <summary>
        /// A link is read from the object it is rendered on: from its source
        /// under the label of its relation, from its target under the inverse
        /// one.
        /// </summary>
        [Fact]
        public void Link_ReadsFromBothEnds()
        {
            // arrange
            var link = ObjectLink("INC-1", "CHG-1", RelationType.Blocks);

            // act & validation
            Assert.False(link.IsInverseFor("INC-1"));
            Assert.True(link.IsInverseFor("CHG-1"));
            Assert.Equal("CHG-1", link.Opposite("INC-1").Key);
            Assert.Equal("INC-1", link.Opposite("CHG-1").Key);
        }

        /// <summary>
        /// A unidirectional link is only visible on its source, so the target
        /// never renders it under the inverse label.
        /// </summary>
        [Fact]
        public void Link_UnidirectionalIsNeverReadFromItsTarget()
        {
            // arrange
            var link = ObjectLink("INC-1", "CHG-1", RelationType.Blocks);
            link.Direction = RelationDirection.Unidirectional;

            // act & validation
            Assert.False(link.IsInverseFor("CHG-1"));
        }

        /// <summary>
        /// A symmetric relation reads alike from either end.
        /// </summary>
        [Fact]
        public void RelationType_SymmetricReadsAlikeFromBothEnds()
        {
            // arrange
            var type = new RelationType { Label = "similar to", InverseLabel = "ignored", Symmetric = true };

            // act & validation
            Assert.Equal("similar to", type.LabelFor(false));
            Assert.Equal("similar to", type.LabelFor(true));
        }

        /// <summary>
        /// Builds a link between two objects of the native object system.
        /// </summary>
        /// <param name="source">The key of the source.</param>
        /// <param name="target">The key of the target.</param>
        /// <param name="type">The id of the relation.</param>
        /// <returns>The link.</returns>
        private static Relation ObjectLink(string source, string target, string type)
        {
            return new Relation
            {
                System = RelationSystem.Object,
                Type = type,
                Source = new RelationReference { Key = source, Class = "Incident" },
                Target = new RelationReference { Key = target, Class = "Change" }
            };
        }
    }
}
