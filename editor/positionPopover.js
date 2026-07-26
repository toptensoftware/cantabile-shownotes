import { computePosition, flip, shift } from 'https://cdn.jsdelivr.net/npm/@floating-ui/dom@1.6.12/+esm';


export function positionPopover(ev)
{
    if (ev.newState != 'open')
        return;

    // Get the popover and it's triggering button
    let popover = ev.target;
    let button = popover.closest(`[popovertarget="${popover.id}"]`);

    // Position the popover
    computePosition(button, popover, {
        placement: 'bottom-end',
        strategy: 'fixed',
        middleware: [ 
            flip(), 
            shift({padding: 10}) 
        ]
      }).then(({x, y}) => {
      Object.assign(popover.style, {
        left: `${x}px`,
        top: `${y}px`,
        margin: `0`,
      });
    });

    // Close on click?
    if (popover.dataset.autoClose)
    {
        function click_handler(ev)
        {
            let a = ev.target.closest('a');
            if (!a.href || a.href == '#')
            {
                ev.preventDefault();
                popover.hidePopover();
            }
        }

        popover.addEventListener("click", click_handler);
        popover.addEventListener("toggle", () => {
            if (ev.newState != 'open')
                popover.removeEventListener("click", click_handler);
        });
    }

}

