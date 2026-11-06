using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebAttribute;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebApp.WebRestApi.WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebIndex;
using WebExpress.WebIndex.Queries;
using WebExpress.WebUI.WebIcon;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Tests how a CRUD endpoint takes a picture that an avatar input sends inline.
    /// </summary>
    public class UnitTestRestApiCrudImage
    {
        private const string Png = "iVBORw0KGgo=";

        /// <summary>
        /// Tests that an inline picture without a storage hook is kept as a data url instead of
        /// turning into an empty http address.
        /// </summary>
        /// <param name="value">The inline picture as the avatar input posts it.</param>
        [Theory]
        [InlineData("file:me.png;data:image/png;base64," + Png)]
        [InlineData("data:image/png;base64," + Png)]
        public void InlinePictureIsKeptAsDataUrl(string value)
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new ImageEndpoint();

            // act
            var response = api.Update(Put(api.Item.Id, $"{{\"image\":\"{value}\"}}"));

            // validation
            Assert.Equal(200, response.Status);
            Assert.Equal("data:image/png;base64," + Png, api.Item.Image?.Uri?.ToString());
        }

        /// <summary>
        /// Tests that the storage hook receives the decoded picture and the item keeps the address
        /// the hook returns.
        /// </summary>
        [Fact]
        public void StoredPictureIsLinked()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new ImageEndpoint() { Store = image => $"/images/{image.Fingerprint}{image.Extension}" };

            // act
            var response = api.Update(Put(api.Item.Id, $"{{\"image\":\"file:me.png;data:image/png;base64,{Png}\"}}"));

            // validation
            Assert.Equal(200, response.Status);
            Assert.Equal("image/png", api.Stored.MediaType);
            Assert.Equal(8, api.Stored.Content.Length);
            Assert.Equal($"/images/{api.Stored.Fingerprint}.png", api.Item.Image?.Uri?.ToString());
        }

        /// <summary>
        /// Tests that an empty entry removes the picture and calls the removal hook.
        /// </summary>
        [Fact]
        public void EmptyEntryRemovesPicture()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new ImageEndpoint();

            // act
            var response = api.Update(Put(api.Item.Id, "{\"image\":\"\"}"));

            // validation
            Assert.Equal(200, response.Status);
            Assert.Null(api.Item.Image);
            Assert.Equal("Image", api.Removed);
        }

        /// <summary>
        /// Tests that a picture the form did not send, and one that still holds its address, are
        /// both left as they are.
        /// </summary>
        /// <param name="body">The json body of the update.</param>
        [Theory]
        [InlineData("{\"name\":\"renamed\"}")]
        [InlineData("{\"image\":\"/images/old.png\"}")]
        public void UneditedPictureStays(string body)
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new ImageEndpoint();

            // act
            var response = api.Update(Put(api.Item.Id, body));

            // validation
            Assert.Equal(200, response.Status);
            Assert.Equal("/images/old.png", api.Item.Image?.Uri?.ToString());
            Assert.Null(api.Removed);
            Assert.Null(api.Stored);
        }

        /// <summary>
        /// Tests that a picture of a refused type is answered with a validation error and stored nowhere.
        /// </summary>
        [Fact]
        public void RefusedPictureIsAValidationError()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new ImageEndpoint() { Store = _ => "/images/x.svg" };

            // act
            var response = api.Update(Put(api.Item.Id, "{\"image\":\"data:image/svg+xml;base64,PHN2Zz4=\"}"));

            // validation
            Assert.Equal(400, response.Status);
            Assert.Null(api.Stored);
            Assert.Equal("/images/old.png", api.Item.Image?.Uri?.ToString());
        }

        /// <summary>
        /// Builds a json PUT for the item.
        /// </summary>
        /// <param name="id">The id of the item.</param>
        /// <param name="body">The json body.</param>
        /// <returns>The request.</returns>
        private static IRequest Put(Guid id, string body)
        {
            var path = $"/items?id={id}";
            var content =
                $"PUT {path} HTTP/1.1\r\n" +
                "Host: localhost\r\n" +
                "Content-Type: application/json\r\n" +
                "\r\n" +
                body;

            return UnitTestControlFixture.CreateRequestMock(content, "https://example.com" + path);
        }

        /// <summary>
        /// An item with a picture.
        /// </summary>
        public sealed class ImageItem : IIndexItem
        {
            /// <summary>
            /// Gets or sets the id.
            /// </summary>
            public Guid Id { get; set; }

            /// <summary>
            /// Gets or sets the name.
            /// </summary>
            public string Name { get; set; }

            /// <summary>
            /// Gets or sets the picture.
            /// </summary>
            [RestConverter<RestValueConverterImageIcon>]
            public ImageIcon Image { get; set; }

            /// <summary>
            /// Releases the item.
            /// </summary>
            public void Dispose()
            {
            }
        }

        /// <summary>
        /// A CRUD endpoint over a single item that records its image hooks.
        /// </summary>
        private sealed class ImageEndpoint : RestApiCrud<ImageItem>
        {
            /// <summary>
            /// Gets the item.
            /// </summary>
            public ImageItem Item { get; } = new() { Id = Guid.NewGuid(), Image = ImageIcon.FromString("/images/old.png") };

            /// <summary>
            /// Gets or sets the storage, or null to keep pictures inline.
            /// </summary>
            public Func<RestApiAvatarUpload, string> Store { get; set; }

            /// <summary>
            /// Gets the picture the storage hook received.
            /// </summary>
            public RestApiAvatarUpload Stored { get; private set; }

            /// <summary>
            /// Gets the field the removal hook received.
            /// </summary>
            public string Removed { get; private set; }

            /// <summary>
            /// Returns the item.
            /// </summary>
            /// <param name="query">The query.</param>
            /// <param name="context">The query context.</param>
            /// <param name="request">The request.</param>
            /// <returns>The item.</returns>
            protected override IEnumerable<ImageItem> Retrieve(IQuery<ImageItem> query, IQueryContext context, IRequest request)
            {
                return [Item];
            }

            /// <summary>
            /// Records and stores the picture.
            /// </summary>
            /// <param name="item">The persisted item.</param>
            /// <param name="field">The property name.</param>
            /// <param name="image">The picture.</param>
            /// <param name="request">The request.</param>
            /// <returns>The address the storage returns.</returns>
            protected override string StoreImage(ImageItem item, string field, RestApiAvatarUpload image, IRequest request)
            {
                Stored = image;

                return Store?.Invoke(image);
            }

            /// <summary>
            /// Records the removal.
            /// </summary>
            /// <param name="item">The persisted item.</param>
            /// <param name="field">The property name.</param>
            /// <param name="request">The request.</param>
            protected override void RemoveImage(ImageItem item, string field, IRequest request)
            {
                Removed = field;
            }
        }
    }
}
