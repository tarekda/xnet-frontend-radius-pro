import { NextRequest } from "next/server";
import { anthropic, CLAUDE_MODEL, buildThinkingConfig } from "@/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 60;

function buildSystemPrompt(activeContext?: string): string {
  return `You are **Claude Network Ops & RADIUS AI Copilot** — an elite ISP network architect, FreeRADIUS expert, and MikroTik RouterOS specialist embedded inside **Xnet Radius Pro**.

## YOUR DOMAIN EXPERTISE
1. **RADIUS & AAA Authentication**:
   - Access-Request, Access-Accept, Access-Reject, Accounting-Request (Start/Stop/Interim-Update)
   - Diagnosing authentication failures: User-Name mismatch, invalid password, MAC binding lock, Simultaneous-Use violations, expired quota/time limits, Framed-IP-Address assignment failures.
2. **MikroTik RouterOS & Network Infrastructure**:
   - PPPoE Server, IPoE, Hotspot, CAPsMAN, VLAN tagging, Simple Queues, Queue Trees (PCQ), FastPath/FastTrack bypass rules.
   - Diagnosing packet loss, high latency/jitter, MTU/MSS clamping issues, broadcast storms, and CPU spikes on CCR/CRS/RB routers.
3. **ISP Operations, Billing & Dunning**:
   - Voucher lifecycle (generation, active, expired, disabled), subscription renewals, WhatsApp payment reminders, rate-limiting overdue accounts.

## RESPONSE RULES
1. Provide **clear, institutional-grade markdown** with clean headers and bullet points.
2. When proposing MikroTik configuration or diagnostic commands, output them in clear \`/terminal\` code blocks:
   \`\`\`routeros
   /tool ping 8.8.8.8 count=5
   /interface pppoe-server print
   \`\`\`
3. If analyzing an error or auth failure, provide a structured diagnostics summary table:
   | Metric / Issue | Finding | Recommended Action |
   | :--- | :--- | :--- |
4. Keep suggestions practical, actionable, and safe for production ISP environments.

${activeContext ? `\n## ACTIVE NETWORK CONTEXT\n${activeContext}\n` : ""}`;
}

export async function POST(req: NextRequest) {
  try {
    const { messages, context } = await req.json();

    // ---------- Fallback Simulation (if no API key configured) ----------
    if (!anthropic) {
      const lastUserMsg = (messages[messages.length - 1]?.content || "").toLowerCase();
      let simulatedReply =
        `🤖 **Radius AI Network Ops Copilot (Simulated Mode)**\n\n` +
        `*(Add \`ANTHROPIC_API_KEY\` to \`next-app/.env.local\` to unlock live Claude 3.5 Sonnet / Extended Thinking)*\n\n`;

      if (lastUserMsg.includes("auth") || lastUserMsg.includes("failure") || lastUserMsg.includes("reject")) {
        simulatedReply += `### 🔍 Auth Failures & Reject Diagnostics\n\n` +
          `1. **Most Probable Causes**:\n` +
          `   - **MAC Lock Violation**: Subscriber device MAC changed or randomized MAC is active.\n` +
          `   - **Quota Exhaustion**: Profile quota cycle reached 100% capacity.\n` +
          `   - **Simultaneous-Use**: Existing active session stale on NAS without Acct-Stop received.\n\n` +
          `2. **MikroTik Resolution Command**:\n` +
          `\`\`\`routeros\n/interface pppoe-server print where user="<username>"\n/interface pppoe-server remove [find user="<username>"]\n\`\`\``;
      } else if (lastUserMsg.includes("mikrotik") || lastUserMsg.includes("queue") || lastUserMsg.includes("bandwidth") || lastUserMsg.includes("speed")) {
        simulatedReply += `### ⚡ MikroTik Dynamic Queue Profile Script\n\n` +
          `\`\`\`routeros\n# Generated Dynamic Simple Queue for 50M/20M Plan with PCQ Burst\n/queue simple add name="Dynamic_Plan_50M" target=10.100.0.0/16 max-limit=20M/50M burst-limit=30M/75M burst-threshold=15M/40M burst-time=16s/16s priority=8/8\n\`\`\`\n\n` +
          `**Safety Check**: Ensure FastTrack is disabled for queued traffic or mark packets via Mangle for queue trees.`;
      } else if (lastUserMsg.includes("ping") || lastUserMsg.includes("nas") || lastUserMsg.includes("latency") || lastUserMsg.includes("health")) {
        simulatedReply += `### 📊 NAS & Gateway Latency Audit\n\n` +
          `| Gateway Node | Latency (avg) | Packet Drop | Status |\n` +
          `| :--- | :--- | :--- | :--- |\n` +
          `| **Core-CCR-01 (10.0.0.1)** | 0.8ms | 0.0% | 🟢 Optimal |\n` +
          `| **Distribution-NAS-02** | 2.4ms | 0.0% | 🟢 Normal |\n` +
          `| **Tower-AP-North** | 18.2ms | 0.4% | 🟡 Jitter Alert |\n\n` +
          `Recommended: Inspect Tower-AP-North SNR and CCQ link quality.`;
      } else {
        simulatedReply += `Radius Pro engine is operational. I can diagnose RADIUS authentication rejections, generate MikroTik RouterOS firewall/queue scripts, audit bandwidth hogs, and resolve billing/dunning issues.\n\nHow can I assist your network operations today?`;
      }

      return simulatedResponse(simulatedReply);
    }

    // ---------- Live Anthropic API Call ----------
    const systemPrompt = buildSystemPrompt(context);

    const formattedMessages = messages.map((m: any) => {
      if (m.attachmentImage) {
        const cleanBase64 = m.attachmentImage.replace(/^data:image\/\w+;base64,/, "");
        let mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif" = "image/png";
        if (m.attachmentImage.startsWith("data:image/jpeg")) mediaType = "image/jpeg";
        else if (m.attachmentImage.startsWith("data:image/webp")) mediaType = "image/webp";

        return {
          role: m.role === "user" ? "user" : "assistant",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: cleanBase64 },
            },
            {
              type: "text",
              text: m.content || "Please examine this network screenshot / log chart.",
            },
          ],
        };
      }

      return {
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      };
    });

    const lastMsg = (messages[messages.length - 1]?.content || "").toLowerCase();
    const isComplexQuery =
      lastMsg.includes("diagnos") ||
      lastMsg.includes("script") ||
      lastMsg.includes("mikrotik") ||
      lastMsg.includes("queue") ||
      lastMsg.includes("failure") ||
      lastMsg.includes("firewall") ||
      lastMsg.includes("bottleneck");

    const thinkingConfig = isComplexQuery ? buildThinkingConfig(6000) : null;
    const abortController = new AbortController();

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const sendChunk = (text: string) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: text })}\n\n`));
          } catch {}
        };

        const sendMeta = (key: string, value: any) => {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ meta: { [key]: value } })}\n\n`)
            );
          } catch {}
        };

        try {
          const requestParams: any = {
            model: CLAUDE_MODEL,
            max_tokens: thinkingConfig ? 12000 : 2048,
            system: systemPrompt,
            messages: formattedMessages,
          };

          if (thinkingConfig) {
            requestParams.thinking = thinkingConfig.thinking;
            requestParams.temperature = thinkingConfig.temperature;
            sendMeta("extended_thinking", true);
          }

          const streamResponse = anthropic!.messages.stream(requestParams);

          abortController.signal.addEventListener("abort", () => {
            streamResponse.abort();
          });

          for await (const event of streamResponse) {
            if (abortController.signal.aborted) break;
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              sendChunk(event.delta.text);
            }
          }

          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          } catch {}
        } catch (err: any) {
          if (!abortController.signal.aborted) {
            const errMsg = `\n\n⚠️ **Connection Error**: ${err.message || "Stream interrupted"}.`;
            sendChunk(errMsg);
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
            } catch {}
          }
        } finally {
          try { controller.close(); } catch {}
        }
      },
      cancel() {
        abortController.abort();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Extended-Thinking": isComplexQuery ? "true" : "false",
      },
    });
  } catch (error: any) {
    return Response.json({ error: error.message || "Copilot failed" }, { status: 500 });
  }
}

function simulatedResponse(content: string) {
  const encoder = new TextEncoder();
  const words = content.split(" ");
  let idx = 0;

  const stream = new ReadableStream({
    async start(controller) {
      for (const word of words) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ delta: idx === 0 ? word : " " + word })}\n\n`)
        );
        idx++;
        await new Promise((r) => setTimeout(r, 14));
      }

      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Extended-Thinking": "false",
    },
  });
}
