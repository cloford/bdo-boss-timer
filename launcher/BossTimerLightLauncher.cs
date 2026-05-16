using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

namespace BossTimerLightLauncher
{
    internal static class Program
    {
        [STAThread]
        private static void Main()
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string appPath = Path.GetFullPath(Path.Combine(baseDir, "..", "index.html"));

            if (!File.Exists(appPath))
            {
                appPath = Path.GetFullPath(Path.Combine(baseDir, "index.html"));
            }

            if (!File.Exists(appPath))
            {
                MessageBox.Show(
                    "index.html が見つかりません。exeをアプリフォルダ内または dist-light フォルダ内から起動してください。",
                    "ボス出現タイマー",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                return;
            }

            string edgePath = FindEdge();
            if (edgePath == null)
            {
                MessageBox.Show(
                    "Microsoft Edge が見つかりません。軽量版はEdgeのアプリモードを使用します。",
                    "ボス出現タイマー",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                return;
            }

            string appUrl = new Uri(appPath).AbsoluteUri;
            ProcessStartInfo info = new ProcessStartInfo
            {
                FileName = edgePath,
                Arguments = "--app=\"" + appUrl + "\" --no-first-run",
                UseShellExecute = false
            };
            Process.Start(info);
        }

        private static string FindEdge()
        {
            string[] candidates =
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft", "Edge", "Application", "msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Microsoft", "Edge", "Application", "msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Microsoft", "Edge", "Application", "msedge.exe")
            };

            foreach (string candidate in candidates)
            {
                if (File.Exists(candidate))
                {
                    return candidate;
                }
            }

            return null;
        }
    }
}
