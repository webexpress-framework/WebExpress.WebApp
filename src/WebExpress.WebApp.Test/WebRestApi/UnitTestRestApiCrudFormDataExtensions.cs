using System;
using System.Collections.Generic;
using WebExpress.WebApp.WebRestApi;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Provides unit tests for verifying the behavior of
    /// <see cref="RestApiCrudFormDataExtensions.BindTo"/>.
    /// </summary>
    /// <remarks>
    /// A form submits every value as text, so the binder is what turns a payload into an
    /// entity. The cases that matter are the ones the general conversion cannot serve: a
    /// reference held as a guid, an optional value, and an entry that names nothing.
    /// </remarks>
    public class UnitTestRestApiCrudFormDataExtensions
    {
        /// <summary>
        /// The target the payload is bound to.
        /// </summary>
        private class Target
        {
            public string Name { get; set; }
            public Guid ClassId { get; set; }
            public Guid? AssigneeId { get; set; }
            public int Order { get; set; }
            public int? StoryPoints { get; set; }
            public string[] Tags { get; set; }
        }

        /// <summary>
        /// Verifies that a guid submitted as text reaches the property.
        /// </summary>
        [Fact]
        public void BindTo_ParsesGuid_WhenValueIsText()
        {
            // arrange
            var expected = Guid.NewGuid();
            var target = new Target();
            var payload = new RestApiCrudFormData { { "classid", expected.ToString() } };

            // act
            payload.BindTo(target);

            // validation
            Assert.Equal(expected, target.ClassId);
        }

        /// <summary>
        /// Verifies that the braced and the uppercase spelling of a guid are accepted, and
        /// that surrounding whitespace does not prevent the value from being stored.
        /// </summary>
        [Theory]
        [InlineData("d2a1f7c4-0b9e-4c3a-9f6d-8e5b1a2c3d4e")]
        [InlineData("D2A1F7C4-0B9E-4C3A-9F6D-8E5B1A2C3D4E")]
        [InlineData("{d2a1f7c4-0b9e-4c3a-9f6d-8e5b1a2c3d4e}")]
        [InlineData("  d2a1f7c4-0b9e-4c3a-9f6d-8e5b1a2c3d4e  ")]
        public void BindTo_ParsesGuid_WhenValueIsWrittenDifferently(string raw)
        {
            // arrange
            var target = new Target();
            var payload = new RestApiCrudFormData { { "classid", raw } };

            // act
            payload.BindTo(target);

            // validation
            Assert.Equal(Guid.Parse("d2a1f7c4-0b9e-4c3a-9f6d-8e5b1a2c3d4e"), target.ClassId);
        }

        /// <summary>
        /// Verifies that a guid handed in as a guid is stored unchanged.
        /// </summary>
        [Fact]
        public void BindTo_KeepsGuid_WhenValueIsAlreadyAGuid()
        {
            // arrange
            var expected = Guid.NewGuid();
            var target = new Target();
            var payload = new RestApiCrudFormData { { "classid", expected } };

            // act
            payload.BindTo(target);

            // validation
            Assert.Equal(expected, target.ClassId);
        }

        /// <summary>
        /// Verifies that a nullable guid is filled from text.
        /// </summary>
        [Fact]
        public void BindTo_ParsesNullableGuid_WhenValueIsText()
        {
            // arrange
            var expected = Guid.NewGuid();
            var target = new Target();
            var payload = new RestApiCrudFormData { { "assigneeid", expected.ToString() } };

            // act
            payload.BindTo(target);

            // validation
            Assert.Equal(expected, target.AssigneeId);
        }

        /// <summary>
        /// Verifies that an empty entry clears a nullable guid, which is how a selection
        /// submits that nothing is chosen.
        /// </summary>
        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        public void BindTo_ClearsNullableGuid_WhenValueIsEmpty(string raw)
        {
            // arrange
            var target = new Target { AssigneeId = Guid.NewGuid() };
            var payload = new RestApiCrudFormData { { "assigneeid", raw } };

            // act
            payload.BindTo(target);

            // validation
            Assert.Null(target.AssigneeId);
        }

        /// <summary>
        /// Verifies that a null entry clears a nullable guid.
        /// </summary>
        [Fact]
        public void BindTo_ClearsNullableGuid_WhenValueIsNull()
        {
            // arrange
            var target = new Target { AssigneeId = Guid.NewGuid() };
            var payload = new RestApiCrudFormData { { "assigneeid", null } };

            // act
            payload.BindTo(target);

            // validation
            Assert.Null(target.AssigneeId);
        }

        /// <summary>
        /// Verifies that an empty entry leaves a required reference as it is instead of
        /// overwriting it with an empty guid.
        /// </summary>
        [Fact]
        public void BindTo_KeepsGuid_WhenValueIsEmpty()
        {
            // arrange
            var expected = Guid.NewGuid();
            var target = new Target { ClassId = expected };
            var payload = new RestApiCrudFormData { { "classid", "" } };

            // act
            payload.BindTo(target);

            // validation
            Assert.Equal(expected, target.ClassId);
        }

        /// <summary>
        /// Verifies that the empty guid clears a nullable reference, which is what a selection
        /// submits for its "none" entry.
        /// </summary>
        [Fact]
        public void BindTo_ClearsNullableGuid_WhenValueIsTheEmptyGuid()
        {
            // arrange
            var target = new Target { AssigneeId = Guid.NewGuid() };
            var payload = new RestApiCrudFormData { { "assigneeid", Guid.Empty.ToString() } };

            // act
            payload.BindTo(target);

            // validation
            Assert.Null(target.AssigneeId);
        }

        /// <summary>
        /// Verifies that the empty guid leaves a required reference as it is, because it names
        /// no record the reference could point at.
        /// </summary>
        [Fact]
        public void BindTo_KeepsGuid_WhenValueIsTheEmptyGuid()
        {
            // arrange
            var expected = Guid.NewGuid();
            var target = new Target { ClassId = expected };
            var payload = new RestApiCrudFormData { { "classid", Guid.Empty } };

            // act
            payload.BindTo(target);

            // validation
            Assert.Equal(expected, target.ClassId);
        }

        /// <summary>
        /// Verifies that an entry that is not a guid leaves the property as it is.
        /// </summary>
        [Fact]
        public void BindTo_KeepsGuid_WhenValueIsNotAGuid()
        {
            // arrange
            var expected = Guid.NewGuid();
            var target = new Target { ClassId = expected };
            var payload = new RestApiCrudFormData { { "classid", "not-a-guid" } };

            // act
            payload.BindTo(target);

            // validation
            Assert.Equal(expected, target.ClassId);
        }

        /// <summary>
        /// Verifies that a nullable number is filled from text and cleared by an empty entry.
        /// </summary>
        [Fact]
        public void BindTo_BindsNullableValueType()
        {
            // arrange
            var filled = new Target();
            var cleared = new Target { StoryPoints = 5 };

            // act
            new RestApiCrudFormData { { "storypoints", "8" } }.BindTo(filled);
            new RestApiCrudFormData { { "storypoints", "" } }.BindTo(cleared);

            // validation
            Assert.Equal(8, filled.StoryPoints);
            Assert.Null(cleared.StoryPoints);
        }

        /// <summary>
        /// Verifies that a null entry for a property that cannot hold null neither throws nor
        /// stops the properties behind it from being bound.
        /// </summary>
        [Fact]
        public void BindTo_BindsRemainingProperties_WhenValueIsNullForNonNullable()
        {
            // arrange
            var expected = Guid.NewGuid();
            var target = new Target { Order = 3 };
            var payload = new RestApiCrudFormData
            {
                { "order", null },
                { "classid", expected.ToString() },
                { "name", "planning" }
            };

            // act
            payload.BindTo(target);

            // validation
            Assert.Equal(3, target.Order);
            Assert.Equal(expected, target.ClassId);
            Assert.Equal("planning", target.Name);
        }

        /// <summary>
        /// Verifies that the conversions the binder already served are untouched.
        /// </summary>
        [Fact]
        public void BindTo_BindsTextAndNumberAndList()
        {
            // arrange
            var target = new Target();
            var payload = new RestApiCrudFormData
            {
                { "name", "planning" },
                { "order", "7" },
                { "tags", "a;b;c" }
            };

            // act
            payload.BindTo(target);

            // validation
            Assert.Equal("planning", target.Name);
            Assert.Equal(7, target.Order);
            Assert.Equal(new[] { "a", "b", "c" }, target.Tags);
        }

        /// <summary>
        /// Verifies that an empty entry for a list empties the list rather than keeping it,
        /// because a multiple selection submits its cleared state that way.
        /// </summary>
        [Fact]
        public void BindTo_ClearsList_WhenValueIsEmpty()
        {
            // arrange
            var target = new Target { Tags = ["a"] };
            var payload = new RestApiCrudFormData { { "tags", "" } };

            // act
            payload.BindTo(target);

            // validation
            Assert.Equal(new List<string>(), target.Tags);
        }

        /// <summary>
        /// Verifies that an empty entry for text stays an empty text, which is how a cleared
        /// input is submitted.
        /// </summary>
        [Fact]
        public void BindTo_ClearsText_WhenValueIsEmpty()
        {
            // arrange
            var target = new Target { Name = "planning" };
            var payload = new RestApiCrudFormData { { "name", "" } };

            // act
            payload.BindTo(target);

            // validation
            Assert.Equal("", target.Name);
        }
    }
}
