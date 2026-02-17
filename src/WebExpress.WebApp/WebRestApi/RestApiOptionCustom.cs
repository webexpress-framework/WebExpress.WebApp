using System.Collections.Generic;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a customizable row option for a CRUD table in a REST API context.
    /// </summary>
    public class RestApiOptionCustom : RestApiOption
    {
        /// <summary>
        /// Returns the type of the element, represented as a string.
        /// </summary>
        public virtual string Type => "item";

        /// <summary>
        /// Returns or sets the command.
        /// </summary>
        public virtual string Command => "custom";

        /// <summary>
        /// Returns or sets the command args.
        /// </summary>
        public virtual string CommandArg { get; set; }

        /// <summary>
        /// Returns the text.
        /// </summary>
        public virtual string Text { get; set; }

        /// <summary>
        /// Returns the icon.
        /// </summary>
        public virtual string Icon { get; set; }

        /// <summary>
        /// Returns the edit form uri.
        /// </summary>
        public virtual IUri Uri { get; set; }

        /// <summary>
        /// Returns or sets the text color.
        /// </summary>
        public virtual string Color { get; set; } = "text-primary";

        /// <summary>
        /// Returns or sets the primary action, typically invoked on a single click.
        /// </summary>
        public virtual IAction PrimaryAction { get; set; }

        /// <summary>
        /// Returns or sets the secondary action, typically invoked on a double‑click.
        /// </summary>
        public virtual IAction SecondaryAction { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="request">The request object associated with the current operation.</param>
        public RestApiOptionCustom(IRequest request)
            : base(request)
        {
        }

        /// <summary>
        /// Returns a string that represents the current object, formatted 
        /// according to the specified action type.
        /// </summary>
        /// <returns>
        /// A string representation of the current object, formatted based 
        /// on the provided action type.
        /// </returns>
        public override Dictionary<string, object> ToJson()
        {
            var json = base.ToJson();
            json["type"] = Type;
            json["command"] = Command;

            if (Uri is not null)
            {
                json["uri"] = Uri.ToString();
            }

            if (!string.IsNullOrWhiteSpace(CommandArg))
            {
                json["arg"] = CommandArg;
            }

            if (!string.IsNullOrWhiteSpace(Text))
            {
                json["text"] = Text;
            }

            if (Uri is not null)
            {
                json["uri"] = Uri?.ToString();
            }

            if (!string.IsNullOrWhiteSpace(Color))
            {
                json["color"] = Color;
            }

            if (PrimaryAction != null)
            {
                json["primaryAction"] = PrimaryAction.ToJson();
            }

            if (SecondaryAction != null)
            {
                json["secondaryAction"] = SecondaryAction.ToJson();
            }

            return json;
        }
    }
}
