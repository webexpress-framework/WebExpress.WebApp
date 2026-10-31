using System.Collections.Concurrent;
using System.Diagnostics;
using Xunit.Sdk;
using Xunit.v3;

namespace WebExpress.WebApp.Test.JsTest
{
    /// <summary>
    /// Runs the headless JavaScript tests under JsTest as part of the regular
    /// xUnit run. The JavaScript tests exercise the shipped client sources and
    /// therefore need a JavaScript engine; they are executed through the
    /// Node.js test runner. Node.js is an optional, external prerequisite, so
    /// a missing or outdated installation skips the test with a warning
    /// instead of failing the build. The lookup is platform independent: an
    /// explicit WEBEXPRESS_NODE override, the PATH, and well-known install
    /// locations (including the Node.js bundled with Visual Studio) are
    /// probed in that order.
    /// </summary>
    [TestCaseOrderer(typeof(SelectionOrderer))]
    public class UnitTestJavaScript
    {
        /// <summary>
        /// The minimum Node.js major version required by the test harness.
        /// </summary>
        private const int MinimumNodeMajorVersion = 18;

        /// <summary>
        /// The maximum time the Node.js test runner may take before the run
        /// is treated as failed. It only catches a run that hangs: the limit is
        /// wall-clock time, which a busy machine stretches many times over (one
        /// process per core in every test assembly, beside the xUnit tests), so a
        /// performance budget belongs in the test itself.
        /// </summary>
        private static readonly TimeSpan _timeout = TimeSpan.FromMinutes(10);

        /// <summary>
        /// The Node.js executable and its major version, probed once for the
        /// whole test class. Resolving the runtime spawns a process, so the
        /// result is cached to avoid repeating the lookup for every test case.
        /// </summary>
        private static readonly Lazy<(string Path, int Major)> _node = new(() =>
        {
            var path = FindNodeExecutable();
            var major = path == null ? -1 : GetNodeMajorVersion(path);
            return (path, major);
        });

        /// <summary>
        /// The most Node.js processes running at once. xUnit runs the cases of a
        /// theory one after the other, so the files are run ahead of the case
        /// that asks for them; otherwise the processes, which spend most of
        /// their time starting up, would never overlap.
        /// </summary>
        private static readonly int _maxRunning = Environment.ProcessorCount;

        /// <summary>
        /// Guards the run bookkeeping.
        /// </summary>
        private static readonly Lock _gate = new();

        /// <summary>
        /// The run of every file that was asked for or run ahead, by file name.
        /// </summary>
        private static readonly Dictionary<string, TaskCompletionSource<(int ExitCode, string Log)>> _runs = [];

        /// <summary>
        /// The files not started yet, in the order the theory enumerates them,
        /// which is the order its cases run in. A file a case asks for before
        /// its turn moves to the front, so that case never waits behind files
        /// queued ahead of it.
        /// </summary>
        private static readonly LinkedList<string> _pending = new();

        /// <summary>
        /// The files whose cases the current run selected. Only these are run
        /// ahead: a filtered run must not execute files it left out, whose
        /// failures would never reach the result.
        /// </summary>
        private static readonly HashSet<string> _selected = [];

        /// <summary>
        /// The Node.js processes still running. A run ahead of its case outlives
        /// a test run that is cancelled, and is ended with the host instead of
        /// being left behind.
        /// </summary>
        private static readonly ConcurrentDictionary<Process, byte> _processes = new();

        private static bool _queued;
        private static int _running;

        private readonly ITestOutputHelper _output;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="output">The xUnit output sink for the runner log.</param>
        public UnitTestJavaScript(ITestOutputHelper output)
        {
            _output = output;
        }

        /// <summary>
        /// Enumerates the JsTest/*.test.mjs files so each one is surfaced as
        /// its own xUnit test case. Discovery walks the source tree because
        /// that is where the harness resolves the shipped JavaScript assets
        /// from. The file names stay relative so the test case display names
        /// remain readable and stable across machines.
        /// </summary>
        /// <returns>The file name (without path) of every *.test.mjs file.</returns>
        public static TheoryData<string> JavaScriptTestFiles()
        {
            return [.. GetTestFileNames()];
        }

        /// <summary>
        /// Returns the names of the JsTest/*.test.mjs files in the order the
        /// theory enumerates them.
        /// </summary>
        /// <returns>The file name (without path) of every *.test.mjs file.</returns>
        private static IEnumerable<string> GetTestFileNames()
        {
            return Directory.GetFiles(GetJsTestDirectory(), "*.test.mjs")
                .OrderBy(f => f)
                .Select(Path.GetFileName);
        }

        /// <summary>
        /// Executes a single JsTest/*.test.mjs file through the Node.js test
        /// runner and fails with the captured runner output when the test
        /// fails. Running one file per xUnit test case keeps the individual
        /// JavaScript suites independently visible and rerunnable instead of
        /// collapsing them into a single pass or fail. Skips with a warning
        /// when Node.js is unavailable.
        /// </summary>
        /// <param name="fileName">The *.test.mjs file to run, relative to JsTest.</param>
        [Theory]
        [MemberData(nameof(JavaScriptTestFiles))]
        public async Task RunJavaScriptTest(string fileName)
        {
            var (node, major) = _node.Value;
            if (node == null)
            {
                Assert.Skip("Warning: Node.js was not found (checked WEBEXPRESS_NODE, the PATH and " +
                    "well-known install locations). The JavaScript tests under JsTest were skipped.");
            }

            if (major < MinimumNodeMajorVersion)
            {
                Assert.Skip($"Warning: Node.js at '{node}' is unusable or too old " +
                    $"(major version {major}, required {MinimumNodeMajorVersion} or newer). " +
                    "The JavaScript tests under JsTest were skipped.");
            }

            var directory = GetJsTestDirectory();
            var file = Path.Combine(directory, fileName);
            Assert.True(File.Exists(file), $"The JavaScript test file '{file}' was not found.");

            var (exitCode, log) = await RunAhead(node, directory, fileName);

            _output.WriteLine($"node: {node}");
            _output.WriteLine(log);
            Assert.True(exitCode == 0,
                $"The JavaScript test '{fileName}' failed (node exit code {exitCode}).{Environment.NewLine}{log}");
        }

        /// <summary>
        /// Locates the Node.js executable in a platform independent way. The
        /// WEBEXPRESS_NODE environment variable wins so CI systems can pin a
        /// specific runtime; otherwise the PATH and the conventional install
        /// locations of the current platform are probed.
        /// </summary>
        /// <returns>The full path of the executable, or null when not found.</returns>
        private static string FindNodeExecutable()
        {
            var overridePath = Environment.GetEnvironmentVariable("WEBEXPRESS_NODE");
            if (!string.IsNullOrWhiteSpace(overridePath) && File.Exists(overridePath))
            {
                return overridePath;
            }

            var fileName = OperatingSystem.IsWindows() ? "node.exe" : "node";
            var pathVariable = Environment.GetEnvironmentVariable("PATH") ?? "";
            foreach (var entry in pathVariable.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries))
            {
                var candidate = Path.Combine(entry.Trim(), fileName);
                if (File.Exists(candidate))
                {
                    return candidate;
                }
            }

            return EnumerateWellKnownLocations().FirstOrDefault(File.Exists);
        }

        /// <summary>
        /// Yields the conventional Node.js install locations of the current
        /// platform. On Windows this includes the private Node.js that Visual
        /// Studio ships for its build tooling, which is sufficient for the
        /// test runner even when no standalone Node.js is installed.
        /// </summary>
        /// <returns>Candidate paths of the executable.</returns>
        private static IEnumerable<string> EnumerateWellKnownLocations()
        {
            if (!OperatingSystem.IsWindows())
            {
                yield return "/usr/local/bin/node";
                yield return "/usr/bin/node";
                yield return "/opt/homebrew/bin/node";
                yield break;
            }

            var programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            var programFilesX86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
            var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);

            yield return Path.Combine(programFiles, "nodejs", "node.exe");
            yield return Path.Combine(programFilesX86, "nodejs", "node.exe");
            yield return Path.Combine(localAppData, "Programs", "nodejs", "node.exe");

            var visualStudioRoot = Path.Combine(programFiles, "Microsoft Visual Studio");
            if (!Directory.Exists(visualStudioRoot))
            {
                yield break;
            }
            foreach (var versionDirectory in Directory.EnumerateDirectories(visualStudioRoot))
            {
                foreach (var editionDirectory in Directory.EnumerateDirectories(versionDirectory))
                {
                    yield return Path.Combine(editionDirectory,
                        "MSBuild", "Microsoft", "VisualStudio", "NodeJs", "node.exe");
                }
            }
        }

        /// <summary>
        /// Determines the major version of a Node.js executable by invoking
        /// "node --version".
        /// </summary>
        /// <param name="node">The path of the executable.</param>
        /// <returns>The major version, or -1 when the probe fails.</returns>
        private static int GetNodeMajorVersion(string node)
        {
            try
            {
                var info = new ProcessStartInfo
                {
                    FileName = node,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };
                info.ArgumentList.Add("--version");

                using var process = Process.Start(info);
                var version = process.StandardOutput.ReadToEnd().Trim();
                process.WaitForExit(10000);

                // the output has the form "v24.12.0"
                var major = version.TrimStart('v').Split('.')[0];
                return int.TryParse(major, out var value) ? value : -1;
            }
            catch
            {
                return -1;
            }
        }

        /// <summary>
        /// Locates the JsTest source folder by walking up from the test
        /// assembly location to the project directory. The tests must run
        /// from the source tree because the harness resolves the shipped
        /// JavaScript assets relative to its own location.
        /// </summary>
        /// <returns>The full path of the JsTest folder.</returns>
        private static string GetJsTestDirectory()
        {
            var directory = new DirectoryInfo(AppContext.BaseDirectory);
            while (directory != null)
            {
                var candidate = Path.Combine(directory.FullName, "JsTest");
                if (Directory.Exists(candidate))
                {
                    return candidate;
                }
                directory = directory.Parent;
            }
            throw new DirectoryNotFoundException(
                $"The JsTest folder was not found above '{AppContext.BaseDirectory}'.");
        }

        /// <summary>
        /// Returns the run of a test file, starting it ahead of the other files
        /// when it has not started yet. The first call queues every selected
        /// file, so the cases that follow find their run under way or done.
        /// </summary>
        /// <param name="node">The path of the executable.</param>
        /// <param name="directory">The JsTest folder.</param>
        /// <param name="fileName">The *.test.mjs file the case runs.</param>
        /// <returns>The exit code and the combined stdout/stderr log.</returns>
        private static Task<(int ExitCode, string Log)> RunAhead(string node, string directory, string fileName)
        {
            lock (_gate)
            {
                if (!_queued)
                {
                    _queued = true;
                    foreach (var file in GetTestFileNames().Where(_selected.Contains))
                    {
                        _pending.AddLast(file);
                    }
                    AppDomain.CurrentDomain.ProcessExit += (_, _) => EndRunning();
                }

                if (!_runs.TryGetValue(fileName, out var run))
                {
                    run = new TaskCompletionSource<(int ExitCode, string Log)>(TaskCreationOptions.RunContinuationsAsynchronously);
                    _runs[fileName] = run;
                    _pending.Remove(fileName);
                    _pending.AddFirst(fileName);
                }

                StartPending(node, directory);

                return run.Task;
            }
        }

        /// <summary>
        /// Starts pending files until the limit of running processes is reached.
        /// Must be called while holding the gate.
        /// </summary>
        /// <param name="node">The path of the executable.</param>
        /// <param name="directory">The JsTest folder.</param>
        private static void StartPending(string node, string directory)
        {
            while (_running < _maxRunning && _pending.First is { } next)
            {
                var fileName = next.Value;
                _pending.RemoveFirst();

                if (!_runs.TryGetValue(fileName, out var run))
                {
                    run = new TaskCompletionSource<(int ExitCode, string Log)>(TaskCreationOptions.RunContinuationsAsynchronously);
                    _runs[fileName] = run;
                }

                _running++;

                _ = Task.Run(async () =>
                {
                    try
                    {
                        run.SetResult(await RunNode(node, directory, ["--test", Path.Combine(directory, fileName)]));
                    }
                    catch (Exception ex)
                    {
                        run.SetException(ex);
                    }
                    finally
                    {
                        lock (_gate)
                        {
                            _running--;
                            StartPending(node, directory);
                        }
                    }
                });
            }
        }

        /// <summary>
        /// Ends the Node.js processes that are still running when the host exits.
        /// </summary>
        private static void EndRunning()
        {
            foreach (var process in _processes.Keys)
            {
                try
                {
                    process.Kill(entireProcessTree: true);
                }
                catch
                {
                    // the process ended on its own in the meantime
                }
            }
        }

        /// <summary>
        /// Runs the Node.js executable with the given arguments and captures
        /// the combined output.
        /// </summary>
        /// <param name="node">The path of the executable.</param>
        /// <param name="workingDirectory">The working directory of the run.</param>
        /// <param name="arguments">The command line arguments.</param>
        /// <returns>The exit code and the combined stdout/stderr log.</returns>
        private static async Task<(int ExitCode, string Log)> RunNode(string node, string workingDirectory, IEnumerable<string> arguments)
        {
            var info = new ProcessStartInfo
            {
                FileName = node,
                WorkingDirectory = workingDirectory,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            foreach (var argument in arguments)
            {
                info.ArgumentList.Add(argument);
            }

            using var process = Process.Start(info);
            _processes.TryAdd(process, 0);

            try
            {
                // drain both streams concurrently so neither pipe can fill up and
                // deadlock the runner
                var stdout = process.StandardOutput.ReadToEndAsync();
                var stderr = process.StandardError.ReadToEndAsync();

                using var timeout = new CancellationTokenSource(_timeout);
                try
                {
                    await process.WaitForExitAsync(timeout.Token);
                }
                catch (OperationCanceledException)
                {
                    try
                    {
                        process.Kill(entireProcessTree: true);
                    }
                    catch
                    {
                        // the process ended between the timeout and the kill
                    }
                    return (-1, $"The Node.js test runner timed out after {_timeout.TotalSeconds:0} seconds.");
                }

                var log = string.Join(Environment.NewLine,
                    new[] { await stdout, await stderr }
                        .Where(part => !string.IsNullOrWhiteSpace(part)));
                return (process.ExitCode, log);
            }
            finally
            {
                _processes.TryRemove(process, out _);
            }
        }

        /// <summary>
        /// Notes which files the selected cases run and keeps xUnit's default
        /// order. xUnit hands an orderer exactly the cases a filter left, before
        /// any of them runs, which is the only place the selection is known.
        /// </summary>
        public sealed class SelectionOrderer : ITestCaseOrderer
        {
            /// <summary>
            /// Records the files of the given cases and returns them in the
            /// default order.
            /// </summary>
            /// <remarks>
            /// A theory whose data is enumerated at run time - the default - is a
            /// single case that runs every file; a pre-enumerated theory is a
            /// case per file, carrying the file as its argument.
            /// </remarks>
            /// <typeparam name="TTestCase">The type of the test cases.</typeparam>
            /// <param name="testCases">The selected test cases.</param>
            /// <returns>The test cases in the order to be run.</returns>
            public IReadOnlyCollection<TTestCase> OrderTestCases<TTestCase>(IReadOnlyCollection<TTestCase> testCases)
                where TTestCase : notnull, ITestCase
            {
                lock (_gate)
                {
                    foreach (var testCase in testCases)
                    {
                        if (testCase is IXunitDelayEnumeratedTestCase)
                        {
                            _selected.UnionWith(GetTestFileNames());
                        }
                        else if (testCase is XunitTestCase { TestMethodArguments: [string fileName] })
                        {
                            _selected.Add(fileName);
                        }
                    }
                }

                return DefaultTestCaseOrderer.Instance.OrderTestCases(testCases);
            }
        }
    }
}
