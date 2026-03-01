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
          // Buffer tokens and flush at a fixed cadence to reduce render churn.
          tokenBufferRef.current += (parsed.text || "");
          if (!tokenFlushTimerRef.current) {
            tokenFlushTimerRef.current = setTimeout(() => {
              tokenFlushTimerRef.current = null;
              const buffered = tokenBufferRef.current;
              tokenBufferRef.current = "";
              if (!buffered) return;
              updateSession(activeSession.id, (session) => ({
                ...session,
                messages: session.messages.map((msg) =>
                  msg.id === assistantMessage.id
                    ? {
                      ...msg,
                      content: msg.content + buffered,
                      hasAnswerStarted: true
                    }
                    : msg
                )
              }));
            }, STREAM_FLUSH_INTERVAL_MS);
          }
        }

        if (eventName === "activity") {
          const activityKey = parsed.tool
            ? `tool:${parsed.tool}`
            : parsed.state;
          if (!activityKey) return;
          updateSession(activeSession.id, (session) => {
            let changed = false;
            const nextMessages = session.messages.map((msg) => {
              if (msg.id !== assistantMessage.id) return msg;
              const current = msg.activities || [];
              if (current.includes(activityKey)) return msg;
              changed = true;
              return { ...msg, activities: [...current, activityKey] };
            });
            return changed ? { ...session, messages: nextMessages } : session;
          });
        }



        if (eventName === "metadata") {
          let toolEvents = extractToolEventsFromMetadata(parsed);
          if (toolEvents.length === 0) {
            toolEvents = extractToolEventsFromText(payload);
          }
          if (toolEvents.length === 0 && typeof parsed?.value === "string") {
            toolEvents = extractToolEventsFromText(parsed.value);
          }
          if (toolEvents.length === 0) return;

          updateSession(activeSession.id, (session) => {
            let changed = false;
            const nextMessages = session.messages.map((msg) => {
              if (msg.id !== assistantMessage.id) return msg;

              const existingSteps = msg.agentSteps || [];
              const existingActivities = msg.activities || [];
              const stepSignatures = new Set(existingSteps.map((step) => JSON.stringify(step)));
              const activitySet = new Set(existingActivities);

              let nextSteps = existingSteps;
              let nextActivities = existingActivities;

              for (const toolEvent of toolEvents) {
                const derived = deriveStepsFromToolEvent(toolEvent);
                for (const step of derived.steps) {
                  const signature = JSON.stringify(step);
                  if (stepSignatures.has(signature)) continue;
                  stepSignatures.add(signature);
                  if (nextSteps === existingSteps) nextSteps = [...existingSteps];
                  nextSteps.push(step);
                }
                for (const activityKey of derived.activities) {
                  if (!activityKey || activitySet.has(activityKey)) continue;
                  activitySet.add(activityKey);
                  if (nextActivities === existingActivities) nextActivities = [...existingActivities];
                  nextActivities.push(activityKey);
                }
              }

              if (nextSteps.length > 60) {
                nextSteps = nextSteps.slice(-60);
              }

              if (nextSteps !== existingSteps || nextActivities !== existingActivities) {
                changed = true;
                return {
                  ...msg,
                  agentSteps: nextSteps,
                  activities: nextActivities
                };
              }

              return msg;
            });

            return changed ? { ...session, messages: nextMessages } : session;
          });
        }

        if (eventName === "agentStep") {
          updateSession(activeSession.id, (session) => {
            let changed = false;
            const nextMessages = session.messages.map((msg) => {
              if (msg.id !== assistantMessage.id) return msg;
              const currentSteps = msg.agentSteps || [];
              const lastStep = currentSteps[currentSteps.length - 1];
              const isDuplicate =
                lastStep &&
                JSON.stringify(lastStep) === JSON.stringify(parsed);
              if (isDuplicate) return msg;
              changed = true;
              return {
                ...msg,
                agentSteps: [...currentSteps, parsed].slice(-60)
              };
            });
            return changed ? { ...session, messages: nextMessages } : session;
          });
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

      