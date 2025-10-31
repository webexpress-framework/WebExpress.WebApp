using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Meta information of a CRUD option (e.g. Edit, Delete, ...).
    /// </summary>
    public class ControlRestTableOptionItem
    {
        /// <summary>
        /// The types of an option entry.
        /// </summary>
        public enum OptionType { Item, Header, Divider };

        /// <summary>
        /// Returns or sets the type of an option entry.
        /// </summary>
        [JsonIgnore]
        public OptionType Type { get; private set; }

        /// <summary>
        /// Returns or sets the label of an option entry. Null for separators.
        /// </summary>
        [JsonPropertyName("label")]
        public string Label { get; set; }

        /// <summary>
        /// Returns or sets the icon of an option entry.
        /// </summary>
        [JsonPropertyName("icon")]
        public string Icon { get; set; }

        /// <summary>
        /// Returns or sets the color of the option entry.
        /// </summary>
        [JsonPropertyName("color")]
        public string Color { get; set; }

        /// <summary>
        ///Returns or sets the uri.
        /// </summary>
        [JsonPropertyName("uri")]
        public string Uri { get; set; }

        /// <summary>
        /// Returns or sets the css.
        /// </summary>
        [JsonPropertyName("css")]
        public string CSS => Type switch { OptionType.Divider => "dropdown-divider", OptionType.Header => "dropdown-header", _ => "dropdown-item" };

        /// <summary>
        /// Returns or sets a function that determines whether the entry should be disabled. The value describes the 
        /// body of a java script function that returns a bool value (e.g. return true;). The parameter is the 
        /// item (data object).
        /// </summary>
        [JsonPropertyName("disabled")]
        public string Disabled { get; set; }

        /// <summary>
        /// Returns or sets an action to be called when the link is clicked. The value describes the body of a 
        /// java script function, which is called when the link is clicked (e.g. older("hello");). The parameters 
        /// are the item (data object) and the options (this object).
        /// </summary>
        [JsonPropertyName("onclick")]
        public string OnClick { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public ControlRestTableOptionItem()
        {
            Type = OptionType.Divider;
        }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="label">The label of the column.</param>
        /// <param name="type">The type of option entry.</param>
        public ControlRestTableOptionItem(string label, OptionType type = OptionType.Item)
        {
            Label = label;
            Type = type;
        }
    }
}
