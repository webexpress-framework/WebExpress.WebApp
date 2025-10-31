using System;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Dialog that contains the progress bar of a web task.
    /// </summary>
    public class ControlRestModalProgressTask : ControlModal
    {
        /// <summary>
        /// Returns or sets the progress bar.
        /// </summary>
        private ControlProgress Progress { get; set; }

        /// <summary>
        /// Returns or sets the progress message.
        /// </summary>
        private ControlText Message { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlRestModalProgressTask(string id)
            : base(id ?? Guid.NewGuid().ToString())
        {
            Progress = new ControlProgress($"progressbar-{Id}")
            {
                Margin = new PropertySpacingMargin(PropertySpacing.Space.Two),
                Color = new PropertyColorProgress(TypeColorProgress.Primary),
                Format = TypeFormatProgress.Animated
            };

            Message = new ControlText($"message-{Id}")
            {
                Margin = new PropertySpacingMargin(PropertySpacing.Space.Two),
                TextColor = new PropertyColorText(TypeColorText.Secondary)
            };

            //Fade = false;
            //ShowIfCreated = true;

            Add(Progress);
            Add(Message);
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree representing the control's structure.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            //var module = ComponentManager.ModuleManager.GetModule(context.ApplicationContext, typeof(Module));
            //var code = $"updateTaskModal('{Id}', '{module?.ContextPath.Append("api/v1/taskstatus")}')";


            //renderContext.VisualTree.AddScript("webexpress.webapp:controlapimodalprogresstaskstate", code);

            return base.Render(renderContext, visualTree);
        }
    }
}
