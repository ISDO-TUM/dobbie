import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { Octokit } from 'octokit';

@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);

  // The template repository to fork from (Change this to your actual template)
  private readonly TEMPLATE_OWNER = 'Uni-Dobby';
  private readonly TEMPLATE_REPO = 'dobbie-template';

  /**
   * Forks the template repository into the user's account (or specified Org).
   */
  async createSovereignRepo(
    token: string,
    repoName: string,
    description: string,
  ) {
    try {
      const octokit = new Octokit({ auth: token });

      // Get the authenticated user
      const { data: user } = await octokit.rest.users.getAuthenticated();

      this.logger.log(`Creating repo ${repoName} for user ${user.login}...`);

      // Option A: Use 'generate' endpoint (Create repo from template)
      // This is cleaner than forking as it starts with a clean history
      const response = await octokit.rest.repos.createUsingTemplate({
        template_owner: this.TEMPLATE_OWNER,
        template_repo: this.TEMPLATE_REPO,
        name: repoName,
        description: description,
        owner: user.login, // or an org name if provided
        private: true, // Default to private for security
        include_all_branches: false,
      });

      return {
        repoUrl: response.data.html_url,
        owner: response.data.owner.login,
        name: response.data.name,
      };
    } catch (error) {
      this.logger.error('Failed to create GitHub repo', error);
      throw new HttpException(
        `GitHub Error: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Adds a list of users as collaborators to the repository.
   */
  async addCollaborators(
    token: string,
    owner: string,
    repo: string,
    usernames: string[],
  ) {
    const octokit = new Octokit({ auth: token });
    const results: Array<{ username: string; status: string; error?: string }> =
      [];

    for (const username of usernames) {
      try {
        if (!username) continue;

        await octokit.rest.repos.addCollaborator({
          owner,
          repo,
          username,
          permission: 'push', // Give them write access
        });
        results.push({ username, status: 'invited' });
      } catch (e) {
        this.logger.warn(`Failed to add ${username}: ${e.message}`);
        results.push({ username, status: 'failed', error: e.message });
      }
    }
    return results;
  }
}
