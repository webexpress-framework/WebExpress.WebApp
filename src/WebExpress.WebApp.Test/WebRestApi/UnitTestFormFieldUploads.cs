using System;
using System.Linq;
using System.Collections.Generic;
using System.Text.Json;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebRestApi;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Protects partial update intent and avatar validation boundaries.
    /// </summary>
    public class UnitTestFormFieldUploads
    {
        /// <summary>
        /// Distinguishes omission, clearing, conversion and invalid values.
        /// </summary>
        [Fact]
        public void TypedFieldsPreserveIntent()
        {
            // arrange
            var id = Guid.NewGuid();
            var fields = new RestApiCrudFormData { ["Count"] = "12", ["Empty"] = "", ["Bad"] = "abc", ["Reference"] = id.ToString(), ["None"] = Guid.Empty };
            // act
            var number = fields.Detach<int>("COUNT");
            // validation
            Assert.Equal(12, number.Value);
            Assert.Equal(RestApiFormFieldState.Valid, number.State);
            Assert.False(fields.ContainsKey("count"));
            Assert.Equal(RestApiFormFieldState.Missing, fields.TryRead<int>("count").State);
            Assert.Equal(RestApiFormFieldState.Empty, fields.TryRead<string>("empty").State);
            Assert.Equal(RestApiFormFieldState.Invalid, fields.TryRead<int>("bad").State);
            Assert.Equal(id, fields.ReadOptionalGuid("reference").Value);
            Assert.Equal(RestApiFormFieldState.Empty, fields.ReadOptionalGuid("none").State);
        }

        /// <summary>
        /// Keeps JSON array elements intact instead of interpreting serialized JSON as delimited text.
        /// </summary>
        [Fact]
        public void JsonArraysPreserveTypedElements()
        {
            // arrange
            using var json = JsonDocument.Parse("""["a;b","quoted\"value",""]""");
            var fields = new RestApiCrudFormData { ["tags"] = json.RootElement };

            // act
            var array = fields.TryRead<string[]>("tags");
            var list = fields.TryRead<List<string>>("tags");
            var scalar = fields.TryRead<string>("tags");

            // validation
            Assert.Equal(RestApiFormFieldState.Valid, array.State);
            Assert.Equal(new[] { "a;b", "quoted\"value", "" }, array.Value);
            Assert.Equal(array.Value, list.Value);
            Assert.Equal(RestApiFormFieldState.Invalid, scalar.State);
        }

        /// <summary>
        /// Reports incompatible array members without returning a successful partial conversion.
        /// </summary>
        [Theory]
        [InlineData("[1,2]", RestApiFormFieldState.Valid)]
        [InlineData("[]", RestApiFormFieldState.Valid)]
        [InlineData("[1,\"bad\"]", RestApiFormFieldState.Invalid)]
        public void JsonArrayConversionValidatesMembers(string value, RestApiFormFieldState expected)
        {
            // arrange
            using var json = JsonDocument.Parse(value);
            var fields = new RestApiCrudFormData { ["values"] = json.RootElement };

            // act
            var result = fields.Detach<int[]>("values");

            // validation
            Assert.Equal(expected, result.State);
            Assert.Empty(fields);
            if (expected == RestApiFormFieldState.Valid)
            {
                Assert.Equal(JsonSerializer.Deserialize<int[]>(value), result.Value);
            }
        }

        /// <summary>
        /// Decodes the avatar control format and invokes application hooks only for submitted changes.
        /// </summary>
        [Fact]
        public void AvatarDecodeAndResolve()
        {
            // arrange
            var fields = new RestApiCrudFormData { ["Icon"] = "file:portrait.png;data:image/png;base64,AQID" };
            var validation = new RestApiValidationResult();
            // act
            var upload = fields.DetachAvatar("icon", new RestApiAvatarUploadOptions { MaxBytes = 3 }, validation);
            var image = upload.ResolveAvatar("old", payload => payload.Fingerprint, key => "/images/" + key, null, () => "fallback");
            // validation
            Assert.True(validation.IsValid);
            Assert.Equal(new byte[] { 1, 2, 3 }, upload.Value.Content);
            Assert.Equal(".png", upload.Value.Extension);
            Assert.StartsWith("/images/", image);
            Assert.Empty(fields);
            Assert.Equal("old", new RestApiFormField<RestApiAvatarUpload>(RestApiFormFieldState.Missing)
                .ResolveAvatar<string, string>("old", _ => throw new Exception(), _ => throw new Exception(), () => throw new Exception(), () => throw new Exception()));
            Assert.Equal("fallback", new RestApiFormField<RestApiAvatarUpload>(RestApiFormFieldState.Empty)
                .ResolveAvatar<string, string>("old", null, null, null, () => "fallback"));
        }

        /// <summary>
        /// Rejects malformed, oversized and forbidden uploads with a field error.
        /// </summary>
        /// <param name="value">The submitted upload.</param>
        [Theory]
        [InlineData("data:image/png;base64,?")]
        [InlineData("data:image/png;base64,AQIDBA==")]
        [InlineData("data:image/png;base64,")]
        [InlineData("data:text/html;base64,AQID")]
        [InlineData("https://example.test/picture.png")]
        public void InvalidAvatarReportsValidation(string value)
        {
            // arrange
            var fields = new RestApiCrudFormData { ["icon"] = value };
            var validation = new RestApiValidationResult();
            // act
            var upload = fields.DetachAvatar("icon", new RestApiAvatarUploadOptions { MaxBytes = 3 }, validation);
            // validation
            Assert.Equal(RestApiFormFieldState.Invalid, upload.State);
            Assert.False(validation.IsValid);
            Assert.Single(validation.Errors);
            Assert.Equal("icon", validation.Errors.Single().Field);
            Assert.Throws<InvalidOperationException>(() => upload.ResolveAvatar<string, string>("old", null, null, null, null));
        }
    }
}
