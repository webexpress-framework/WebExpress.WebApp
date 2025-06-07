//using System.Linq;
//using System.Text;
//using System.Text.Json;
//using WebExpress.WebUI.WebControl;

//namespace WebExpress.WebApp.WebApiControl;

//public class ControlApiFormItemInputSelection : ControlFormItemInputSelection, IControlApi
//{
//    /// <summary>
//    /// Returns or sets the uri that determines the options.
//    /// </summary>
//    public string RestUri { get; set; }

//    /// <summary>
//    /// Initializes a new instance of the class.
//    /// </summary>
//    /// <param name="id">The control id.</param>
//    public ControlApiFormItemInputSelection(string id = null)
//        : base(id)
//    {
//    }

//    /// <summary>
//    /// Generates the javascript to control the control.
//    /// </summary>
//    /// <param name="context">The context in which the control is rendered.</param>
//    /// <param name="id">The id of the control.</param>
//    /// <param name="css">The CSS classes that are assigned to the control.</param>
//    /// <returns>The javascript code.</returns>
//    protected override string GetScript(RenderContextForm context, string id, string css)
//    {
//        var settings = new
//        {
//            id = id,
//            name = Name,
//            css = css,
//            placeholder = Placeholder,
//            hidedescription = HideDescription,
//            multiSelect = MultiSelect,
//            optionuri = RestUri?.ToString()
//        };

//        var jsonOptions = new JsonSerializerOptions { WriteIndented = false };
//        var settingsJson = JsonSerializer.Serialize(settings, jsonOptions);
//        var optionsJson = JsonSerializer.Serialize(Options, jsonOptions);
//        var builder = new StringBuilder();

//        builder.AppendLine($"$(document).ready(function () {{");
//        builder.AppendLine($"let settings = {settingsJson};");
//        builder.AppendLine($"var options = {optionsJson};");
//        builder.AppendLine($"let container = $('#{id}');");
//        builder.AppendLine($"let obj = new webexpress.webapp.selectionCtrl(settings);");
//        builder.AppendLine($"obj.options = options;");
//        builder.AppendLine($"obj.receiveData();");
//        builder.AppendLine($"obj.value = [{string.Join(",", Values.Select(x => $"'{x}'"))}];");
//        builder.AppendLine($"obj.on('webexpress.webui.change.filter', function(key) {{ obj.receiveData(key); }});");
//        if (OnChange != null)
//        {
//            builder.AppendLine($"obj.on('webexpress.webui.change.value', function() {{ {OnChange} }});");
//        }
//        builder.AppendLine($"container.replaceWith(obj.getCtrl);");
//        builder.AppendLine($"}});");

//        return builder.ToString();
//    }
//}
