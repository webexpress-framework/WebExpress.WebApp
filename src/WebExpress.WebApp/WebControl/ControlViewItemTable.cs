using System.Linq;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebIcon;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a table control that displays items with associated prompts 
    /// and data.
    /// </summary>
    public class ControlViewItemTable : ControlViewItem
    {
        /// <summary>
        /// Returns the search control used for user input.
        /// </summary>
        public IControlSearch Search { get; } = new ControlSearch();

        /// <summary>
        /// Returns the control table that manages the display 
        /// of data in the user interface.
        /// </summary>
        public IControlRestTable Table { get; } = new ControlRestTable()
        {
        };

        /// <summary>
        /// Returns or sets the REST API endpoint URI associated with the table.
        /// </summary>
        /// <remarks>This property allows the user to specify the URI for REST operations related to the
        /// table. Ensure that the URI is valid and accessible to avoid runtime errors when making API calls.</remarks>
        public IUri WqlUri
        {
            get => Search.RestUri;
            set => (Search as ControlSearch).RestUri = value;
        }

        /// <summary>
        /// Returns or sets the REST API endpoint URI associated with the table.
        /// </summary>
        /// <remarks>This property allows the user to specify the URI for REST operations related to the
        /// table. Ensure that the URI is valid and accessible to avoid runtime errors when making API calls.</remarks>
        public IUri DataUri
        {
            get => Table.RestUri;
            set => (Table as ControlRestTable).RestUri = value;
        }

        /// <summary>
        /// Specifies that the table operates in infinite‑scroll mode, where
        /// paging has no predefined endpoint and more data can always be requested.
        /// </summary>
        public bool Infinite
        {
            get => Table.Infinite;
            set => (Table as ControlRestTable).Infinite = value;
        }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public ControlViewItemTable()
        {
            (Table as ControlRestTable).Bind = new BindSearch()
            {
                Source = Search.Id
            };
        }

        /// <summary>
        /// Converts the column to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree representing the control's structure.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = "wx-view"
            }
                .AddUserAttribute("data-label", I18N.Translate(renderContext, Title))
                .AddUserAttribute("data-description", I18N.Translate(renderContext, Description))
                .AddUserAttribute("data-icon", (Icon as Icon)?.Class)
                .AddUserAttribute("data-image", (Icon as ImageIcon)?.Uri.ToString())
                .AddUserAttribute("data-has-details", DetailFrame ? "true" : null)
                .Add(Search?.Render(renderContext, visualTree))
                .Add(Table?.Render(renderContext, visualTree))
                .Add(Content.Select(x => x.Render(renderContext, visualTree)));

            return html;
        }
    }
}
