//using System;
//using WebExpress.WebCore.WebComponent;
//using WebExpress.WebCore.WebHtml;
//using WebExpress.WebCore.WebPage;
//using WebExpress.WebUI.WebControl;

//namespace WebExpress.WebApp.WebApiControl
//{
//    /// <summary>
//    /// Dialog that contains the progress bar of a web task.
//    /// </summary>
//    public class ControlApiModalProgressTaskState : ControlModal
//    {
//        /// <summary>
//        /// Returns or sets the progress bar.
//        /// </summary>
//        private ControlProgressBar ProgressBar { get; set; }

//        /// <summary>
//        /// Returns or sets the progress message.
//        /// </summary>
//        private ControlText Message { get; set; }

//        /// <summary>
//        /// Initializes a new instance of the class.
//        /// </summary>
//        /// <param name="id">The control id.</param>
//        public ControlApiModalProgressTaskState(string id)
//            : base(id ?? Guid.NewGuid().ToString())
//        {
//            ProgressBar = new ControlProgressBar($"progressbar_{Id}")
//            {
//                Margin = new PropertySpacingMargin(PropertySpacing.Space.Two),
//                Color = new PropertyColorProgress(TypeColorProgress.Primary),
//                Format = TypeFormatProgress.Animated
//            };

//            Message = new ControlText($"message_{Id}")
//            {
//                Margin = new PropertySpacingMargin(PropertySpacing.Space.Two),
//                TextColor = new PropertyColorText(TypeColorText.Secondary)
//            };

//            Fade = false;
//            ShowIfCreated = true;

//            Content.Add(ProgressBar);
//            Content.Add(Message);
//        }

//        /// <summary>
//        /// Convert to html.
//        /// </summary>
//        /// <param name="context">The context in which the control is rendered.</param>
//        /// <returns>The control as html.</returns>
//        public override IHtmlNode Render(RenderContext context)
//        {
//            var module = ComponentManager.ModuleManager.GetModule(context.ApplicationContext, typeof(Module));
//            var code = $"updateTaskModal('{Id}', '{module?.ContextPath.Append("api/v1/taskstatus")}')";


//            context.VisualTree.AddScript("webexpress.webapp:controlapimodalprogresstaskstate", code);

//            return base.Render(context);
//        }
//    }
//}
