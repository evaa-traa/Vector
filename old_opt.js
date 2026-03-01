const parser = createParser((event) => {
        if (event.type !== "event") return;
        const eventName = event.event || "";
        const payload = event.data || "";
        let parsed = null;
        try {
          parsed = JSON.parse(payload);
        } catch (error) {
          parsed = { text: payload };
        }

        if (eventName === "token") {
          hasReceivedData = true;
          // Reset timeout on receiving data
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
              controller.abort();
            }, REQUEST_TIMEOUT_MS);
          }
          // Buffer tokens and flush via rAF for smooth streaming
          tokenBufferRef.current += (parsed.text || "");
          if (!flushScheduledRef.current) {
            flushScheduledRef.current = true;
            requestAnimationFrame(() => {
              const buffered = tokenBufferRef.current;
              tokenBufferRef.current = "";
              flushScheduledRef.current = false;
              if (buffered) {
                updateSession(activeSession.id, (session) => ({
                  ...session,
                  messages: session.messages.map((msg) =>
                    msg.id === assistantMessage.id
                      ? { ...msg, content: msg.content + buffered }
                      : msg
                  )
                }));
              }
            });
          }
        }

        if (eventName === "activity") {
          const activityKey = parsed.tool
            ? `tool:${parsed.tool}`
            : parsed.state;
          updateSession(activeSession.id, (session) => ({
            ...session,
            messages: session.messages.map((msg) =>
              msg.id === assistantMessage.id
                ? {
                  ...msg,
                  activities: Array.from(
                    new Set([...(msg.activities || []), activityKey])
                  )
                }
                : msg
            )
          }));
        }

        if (eventName === "agentStep") {
          updateSession(activeSession.id, (session) => ({
            ...session,
            messages: session.messages.map((msg) =>
              msg.id === assistantMessage.id
                ? {
                  ...msg,
                  agentSteps: [...(msg.agentSteps || []), parsed]
                }
                : msg
            )
          }));
        }

        if (eventName === "error") {
          updateSession(activeSession.id, (session) => ({
            ...session,
            messages: session.messages.map((msg) =>
              msg.id === assistantMessage.id
                ? {
                  ...msg,
                  content:
                    parsed.message || "Something went wrong. Please try again."
                }
                : msg
            )
          }));
        }
      });

      