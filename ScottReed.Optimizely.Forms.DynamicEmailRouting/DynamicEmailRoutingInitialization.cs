using EPiServer.Framework;
using EPiServer.Framework.Initialization;
using EPiServer.ServiceLocation;
using EPiServer.Shell.Modules;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace ScottReed.Optimizely.Forms.DynamicEmailRouting
{
    /// <summary>
    /// Automatically registers the Dynamic Email Routing protected module
    /// with Optimizely CMS during initialization. This ensures the module's
    /// client resources (JS editors) and lang files are served from the
    /// protected module ZIP without any Startup.cs configuration.
    /// </summary>
    [InitializableModule]
    [ModuleDependency(typeof(EPiServer.Web.InitializationModule))]
    public class DynamicEmailRoutingInitialization : IConfigurableModule
    {
        private const string ModuleName = "ScottReed.Optimizely.Forms.DynamicEmailRouting";

        public void ConfigureContainer(ServiceConfigurationContext context)
        {
            context.Services.Configure<ProtectedModuleOptions>(options =>
            {
                if (!options.Items.Any(x =>
                    string.Equals(x.Name, ModuleName, StringComparison.OrdinalIgnoreCase)))
                {
                    options.Items.Add(new ModuleDetails { Name = ModuleName });
                }
            });

            // Register controllers from this assembly so ASP.NET Core discovers them
            context.Services.AddControllers()
                .AddApplicationPart(typeof(DynamicEmailRoutingInitialization).Assembly);
        }

        public void Initialize(InitializationEngine context) { }

        public void Uninitialize(InitializationEngine context) { }
    }
}
